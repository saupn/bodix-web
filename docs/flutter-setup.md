# Flutter Setup Guide — BodiX

## Architecture Recommendation

**Flutter should call Supabase directly** for most operations (auth, database queries, realtime, storage). Only call Next.js API routes for business-logic operations that require server-side processing (payments, check-in with streak calculation, etc.).

```
Flutter App
    ├── Supabase Flutter SDK (auth, DB, realtime, storage)
    └── HTTP calls to bodix.vn/api/* (business logic only)
```

---

## 1. Dependencies

```yaml
# pubspec.yaml
dependencies:
  supabase_flutter: ^2.x.x
  http: ^1.x.x
```

---

## 2. Supabase Initialization

```dart
// main.dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'https://your-project-ref.supabase.co',
    anonKey: 'your-anon-key',
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  runApp(const MyApp());
}

final supabase = Supabase.instance.client;
```

---

## 3. Authentication

BodiX uses phone OTP auth. The Flutter app calls the Next.js API (not Supabase Auth directly) for OTP send/verify because OTP is sent via Zalo ZNS/SMS.

### Send OTP
```dart
Future<void> sendOtp(String phone) async {
  final response = await http.post(
    Uri.parse('https://bodix.vn/api/auth/send-otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'phone': phone}),
  );
  if (response.statusCode != 200) {
    throw Exception(jsonDecode(response.body)['error']);
  }
}
```

### Verify OTP (returns Supabase session)
```dart
Future<void> verifyOtp(String phone, String otp) async {
  // BodiX verifies OTP server-side, then uses Supabase Auth under the hood.
  // Call the API, then exchange for a Supabase session via signInWithOtp.
  final response = await http.post(
    Uri.parse('https://bodix.vn/api/auth/verify-otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'phone': phone, 'otp': otp}),
  );
  if (response.statusCode != 200) {
    throw Exception(jsonDecode(response.body)['error']);
  }
  // After successful verification, sign in with Supabase
  await supabase.auth.signInWithOtp(phone: phone);
}
```

### Listen to Auth State
```dart
supabase.auth.onAuthStateChange.listen((data) {
  final AuthChangeEvent event = data.event;
  final Session? session = data.session;

  if (event == AuthChangeEvent.signedIn) {
    // Navigate to home
  } else if (event == AuthChangeEvent.signedOut) {
    // Navigate to login
  }
});
```

### Get Current User
```dart
final user = supabase.auth.currentUser;
final session = supabase.auth.currentSession;
final accessToken = session?.accessToken;
```

### Sign Out
```dart
await supabase.auth.signOut();
```

---

## 4. Authorization Header for API Calls

When calling Next.js API routes, include the Supabase access token:

```dart
Future<Map<String, String>> getAuthHeaders() async {
  final session = supabase.auth.currentSession;
  if (session == null) throw Exception('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${session.accessToken}',
  };
}

// Example: POST check-in
Future<Map<String, dynamic>> checkin({
  required String enrollmentId,
  required int dayNumber,
  required String mode,
  int? feeling,
}) async {
  final response = await http.post(
    Uri.parse('https://bodix.vn/api/checkin'),
    headers: await getAuthHeaders(),
    body: jsonEncode({
      'enrollment_id': enrollmentId,
      'day_number': dayNumber,
      'mode': mode,
      if (feeling != null) 'feeling': feeling,
    }),
  );
  if (response.statusCode != 200) {
    throw Exception(jsonDecode(response.body)['error']);
  }
  return jsonDecode(response.body);
}
```

---

## 5. Direct Supabase Database Queries

For read-only data, query Supabase directly to avoid Next.js latency.

### Get Active Programs
```dart
final programs = await supabase
    .from('programs')
    .select('id, slug, name, description, duration_days, price_vnd, features')
    .eq('is_active', true)
    .order('sort_order');
```

### Get User's Active Enrollment
```dart
final enrollment = await supabase
    .from('enrollments')
    .select('''
      id, status, current_day, started_at, enrolled_at,
      program:programs(id, slug, name, duration_days, price_vnd),
      cohort:cohorts(id, name, start_date, end_date)
    ''')
    .eq('user_id', supabase.auth.currentUser!.id)
    .eq('status', 'active')
    .maybeSingle();
```

### Get User Profile
```dart
final profile = await supabase
    .from('profiles')
    .select('id, full_name, phone, date_of_birth, gender, fitness_goal, trial_ends_at, role')
    .eq('id', supabase.auth.currentUser!.id)
    .single();
```

### Get Check-in History
```dart
final checkins = await supabase
    .from('daily_checkins')
    .select('id, day_number, workout_date, mode, feeling, feeling_note, duration_minutes, completed_at')
    .eq('enrollment_id', enrollmentId)
    .order('day_number');
```

### Get Streak
```dart
final streak = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, total_completed_days, total_hard_days, last_checkin_date')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
```

### Get Milestones
```dart
final milestones = await supabase
    .from('completion_milestones')
    .select('milestone_type, achieved_at, metadata')
    .eq('enrollment_id', enrollmentId)
    .order('achieved_at');
```

### Get Workout Template
```dart
final workout = await supabase
    .from('workout_templates')
    .select('id, day_number, week_number, title, description, duration_minutes, workout_type, hard_version, light_version, recovery_version')
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
    .single();
```

### Get Notifications
```dart
final notifications = await supabase
    .from('notifications')
    .select('id, type, channel, title, content, metadata, is_read, created_at')
    .eq('user_id', supabase.auth.currentUser!.id)
    .order('created_at', ascending: false)
    .limit(50);
```

### Mark Notification as Read
```dart
await supabase
    .from('notifications')
    .update({'is_read': true, 'read_at': DateTime.now().toIso8601String()})
    .eq('id', notificationId)
    .eq('user_id', supabase.auth.currentUser!.id);
```

---

## 6. Realtime Subscriptions

### Subscribe to Cohort Check-ins (Live Leaderboard)
```dart
final channel = supabase.channel('cohort-checkins-$cohortId');

channel
    .onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'daily_checkins',
      filter: PostgresChangeFilter(
        type: FilterType.eq,
        column: 'cohort_id',
        value: cohortId,
      ),
      callback: (payload) {
        // Refresh leaderboard
        refreshCohortBoard();
      },
    )
    .subscribe();

// Cleanup
channel.unsubscribe();
```

### Subscribe to New Notifications
```dart
final notifChannel = supabase.channel('user-notifications');

notifChannel
    .onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'notifications',
      filter: PostgresChangeFilter(
        type: FilterType.eq,
        column: 'user_id',
        value: supabase.auth.currentUser!.id,
      ),
      callback: (payload) {
        final newRow = payload.newRecord;
        showLocalNotification(newRow['title'], newRow['content']);
      },
    )
    .subscribe();
```

---

## 7. Storage — Progress Photos

### Upload Photo
```dart
Future<String> uploadProgressPhoto(File file, {
  required String enrollmentId,
  required String photoType, // 'before', 'midpoint', 'after', 'weekly'
  int? weekNumber,
}) async {
  // Use the Next.js API (handles DB record + storage in one call)
  final session = supabase.auth.currentSession!;
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('https://bodix.vn/api/photos/upload'),
  );
  request.headers['Authorization'] = 'Bearer ${session.accessToken}';
  request.files.add(await http.MultipartFile.fromPath('file', file.path));
  request.fields['enrollment_id'] = enrollmentId;
  request.fields['photo_type'] = photoType;
  if (weekNumber != null) request.fields['week_number'] = weekNumber.toString();
  request.fields['is_public'] = 'false';

  final response = await request.send();
  final body = jsonDecode(await response.stream.bytesToString());
  return body['signed_url']; // Valid for 1 hour
}
```

### Get Signed URL for Existing Photo (via Next.js)
```dart
// Use /api/community/media?path=... for redirect to signed URL
final url = Uri.parse('https://bodix.vn/api/community/media?path=$storagePath');
// Or directly via Supabase:
final signedUrl = await supabase.storage
    .from('progress-photos')
    .createSignedUrl(storagePath, 3600);
```

---

## 8. RPC Functions

Call SQL functions directly:

```dart
// Get completion rate
final result = await supabase.rpc(
  'get_completion_rate',
  params: {'p_enrollment_id': enrollmentId},
);
final completionRate = result as double;

// Get credit balance
final balance = await supabase.rpc(
  'get_credit_balance',
  params: {'p_user_id': supabase.auth.currentUser!.id},
);
```

---

## 9. Which API to Call — Decision Guide

| Operation | Use |
|---|---|
| Sign in / Sign out | Supabase Auth (after OTP verify) |
| Send/verify OTP | `POST /api/auth/send-otp` + `/verify-otp` |
| Read programs | Supabase direct |
| Read workouts | Supabase direct |
| Read profile | Supabase direct |
| Read notifications | Supabase direct |
| Read check-in history | Supabase direct |
| Read streaks | Supabase direct |
| **Submit check-in** | `POST /api/checkin` (streak calc, milestones) |
| Start trial | `POST /api/trial/start` |
| Checkout create/confirm | `POST /api/checkout/create` + `/confirm` |
| **Weekly review** | `POST /api/reviews/weekly` |
| **Mid-program reflection** | `POST /api/reviews/mid-program` |
| Rescue acknowledge | `POST /api/rescue/acknowledge` |
| Upload photo | `POST /api/photos/upload` |
| Upload community image | `POST /api/community/upload` |
| Toggle reaction | `POST /api/community/posts/[id]/reactions` |
| Referral validate | `GET /api/referral/validate` |
| Referral track click | `POST /api/referral/track` |
| Affiliate withdraw | `POST /api/affiliate/withdraw` |
| Realtime check-ins | Supabase Realtime |
| Realtime notifications | Supabase Realtime |

---

## 10. Error Handling Pattern

```dart
class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

Future<Map<String, dynamic>> apiCall(String path, {
  String method = 'GET',
  Map<String, dynamic>? body,
}) async {
  final session = supabase.auth.currentSession;
  final headers = <String, String>{
    'Content-Type': 'application/json',
    if (session != null) 'Authorization': 'Bearer ${session.accessToken}',
  };

  final uri = Uri.parse('https://bodix.vn$path');
  late http.Response response;

  if (method == 'GET') {
    response = await http.get(uri, headers: headers);
  } else if (method == 'POST') {
    response = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
  } else if (method == 'PUT') {
    response = await http.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
  } else if (method == 'DELETE') {
    response = await http.delete(uri, headers: headers);
  }

  final decoded = jsonDecode(response.body) as Map<String, dynamic>;

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return decoded;
  }

  if (response.statusCode == 401) {
    await supabase.auth.refreshSession();
    // Retry once after refresh
  }

  throw ApiException(decoded['error'] ?? 'Unknown error', response.statusCode);
}
```

---

## 11. Environment Configuration

```dart
// lib/config.dart
class AppConfig {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://your-project-ref.supabase.co',
  );
  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'your-anon-key',
  );
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://bodix.vn',
  );
}
```

Run with:
```bash
flutter run --dart-define=SUPABASE_URL=https://... --dart-define=SUPABASE_ANON_KEY=...
```
