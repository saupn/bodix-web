// 6 phiên tập cơ bản
export const WORKOUT_VIDEOS = {
  A: {
    id: 'A',
    nameEn: 'Lower Body Foundation',
    nameVi: 'Nền tảng thân dưới',
    vimeoUrl: 'https://vimeo.com/1169317064/e0a82f5344',
    duration: 7,
    focus: 'Mông, đùi, bắp chân — xây dựng nền tảng vững chắc',
  },
  B: {
    id: 'B',
    nameEn: 'Upper Body & Posture',
    nameVi: 'Thân trên & Tư thế',
    vimeoUrl: 'https://vimeo.com/1169317210/227fb73582',
    duration: 7,
    focus: 'Vai, tay, ngực — cải thiện tư thế hàng ngày',
  },
  C: {
    id: 'C',
    nameEn: 'Cardio Low Impact',
    nameVi: 'Cardio nhẹ nhàng',
    vimeoUrl: 'https://vimeo.com/1169317274/42f46543a5',
    duration: 7,
    focus: 'Tim mạch, sức bền — không tác động mạnh khớp',
  },
  D: {
    id: 'D',
    nameEn: 'Core & Stability',
    nameVi: 'Cơ trung tâm & Cân bằng',
    vimeoUrl: 'https://vimeo.com/1169317372/4fb61db503',
    duration: 7,
    focus: 'Bụng, lưng, cơ sâu — ổn định cơ thể',
  },
  E: {
    id: 'E',
    nameEn: 'Full Body Flow',
    nameVi: 'Toàn thân linh hoạt',
    vimeoUrl: 'https://vimeo.com/1169317406/e53a1410d5',
    duration: 7,
    focus: 'Kết hợp toàn thân — chuyển động liên tục',
  },
  F: {
    id: 'F',
    nameEn: 'Recovery & Mobility',
    nameVi: 'Phục hồi & Linh hoạt',
    vimeoUrl: 'https://vimeo.com/1169317473/61c7f1223d',
    duration: 7,
    focus: 'Giãn cơ, thư giãn, cải thiện độ linh hoạt',
  },
} as const;

// 6 phiên nâng cao (link cập nhật sau)
export const ADVANCED_VIDEOS = {
  'A+': {
    id: 'A+',
    nameEn: 'Lower Body Strength',
    nameVi: 'Sức mạnh thân dưới',
    vimeoUrl: null as string | null,
    duration: 7,
    focus: 'Đùi, mông — tăng sức mạnh, tạo đường nét',
  },
  'B+': {
    id: 'B+',
    nameEn: 'Upper Body Strength',
    nameVi: 'Sức mạnh thân trên',
    vimeoUrl: null as string | null,
    duration: 7,
    focus: 'Vai, tay, lưng — nâng cao sức mạnh',
  },
  'C+': {
    id: 'C+',
    nameEn: 'Cardio Burn',
    nameVi: 'Cardio đốt mỡ',
    vimeoUrl: null as string | null,
    duration: 7,
    focus: 'Cường độ cao hơn — đốt cháy calo tối đa',
  },
  'D+': {
    id: 'D+',
    nameEn: 'Core & Conditioning',
    nameVi: 'Cơ trung tâm & Thể lực',
    vimeoUrl: null as string | null,
    duration: 7,
    focus: 'Bụng, lưng nâng cao — xây dựng thể lực',
  },
  'E+': {
    id: 'E+',
    nameEn: 'Full Body Power',
    nameVi: 'Toàn thân sức mạnh',
    vimeoUrl: null as string | null,
    duration: 7,
    focus: 'Toàn thân cường độ cao — explosive movements',
  },
  'F+': {
    id: 'F+',
    nameEn: 'Peak Burn',
    nameVi: 'Đốt cháy tối đa',
    vimeoUrl: null as string | null,
    duration: 7,
    focus: 'Tổng hợp cường độ cao nhất — thử thách giới hạn',
  },
} as const;

type BasicVideoId = keyof typeof WORKOUT_VIDEOS;
type AdvancedVideoId = keyof typeof ADVANCED_VIDEOS;

// ============================================
// LỊCH BODIX 21 (3 tuần, 1 video/ngày, rotate)
// ============================================
const MAIN_ROTATION: BasicVideoId[][] = [
  ['A', 'B', 'C', 'D', 'E'],  // Tuần 1
  ['B', 'C', 'D', 'E', 'A'],  // Tuần 2
  ['C', 'D', 'E', 'A', 'B'],  // Tuần 3
];

export function getBodix21Schedule(): Record<number, { videos: BasicVideoId[], type: 'main' | 'recovery' | 'review' }> {
  const schedule: Record<number, { videos: BasicVideoId[], type: 'main' | 'recovery' | 'review' }> = {};
  for (let week = 0; week < 3; week++) {
    const base = week * 7;
    for (let day = 0; day < 5; day++) {
      schedule[base + day + 1] = { videos: [MAIN_ROTATION[week][day]], type: 'main' };
    }
    schedule[base + 6] = { videos: ['F'], type: 'recovery' };
    schedule[base + 7] = { videos: [], type: 'review' };
  }
  return schedule;
}

// ============================================
// LỊCH BODIX 6W (6 tuần, 2 videos/ngày, ghép)
// ============================================
const PAIR_ROTATION: BasicVideoId[][][] = [
  [['A','B'], ['C','D'], ['E','A'], ['B','E'], ['D','C']],  // Tuần 1
  [['C','D'], ['E','A'], ['B','C'], ['D','A'], ['A','E']],  // Tuần 2
  [['E','A'], ['B','C'], ['D','E'], ['A','C'], ['B','D']],  // Tuần 3
  [['B','C'], ['D','E'], ['A','B'], ['C','E'], ['E','A']],  // Tuần 4
  [['D','E'], ['A','B'], ['C','D'], ['B','D'], ['C','B']],  // Tuần 5
  [['A','D'], ['C','E'], ['B','D'], ['A','E'], ['D','B']],  // Tuần 6
];

export function getBodix6WSchedule(): Record<number, { videos: BasicVideoId[], type: 'main' | 'recovery' | 'review' }> {
  const schedule: Record<number, { videos: BasicVideoId[], type: 'main' | 'recovery' | 'review' }> = {};
  for (let week = 0; week < 6; week++) {
    const base = week * 7;
    for (let day = 0; day < 5; day++) {
      schedule[base + day + 1] = { videos: PAIR_ROTATION[week][day], type: 'main' };
    }
    schedule[base + 6] = { videos: ['F'], type: 'recovery' };
    schedule[base + 7] = { videos: [], type: 'review' };
  }
  return schedule;
}

// ============================================
// LỊCH BODIX 12W (12 tuần, 1 cơ bản + 1 nâng cao)
// Cập nhật khi có link nâng cao. Tạm thời dùng ghép 2 cơ bản giống 6W.
// ============================================
export function getBodix12WSchedule(): Record<number, { videos: (BasicVideoId | AdvancedVideoId)[], type: 'main' | 'recovery' | 'review' }> {
  // Tạm: lặp 6W schedule 2 lần (12 tuần)
  // Khi có link nâng cao: thay video thứ 2 bằng A+, B+, C+, D+, E+
  const schedule6w = getBodix6WSchedule();
  const schedule: Record<number, { videos: (BasicVideoId | AdvancedVideoId)[], type: 'main' | 'recovery' | 'review' }> = {};

  // 6 tuần đầu: giống 6W
  for (let day = 1; day <= 42; day++) {
    schedule[day] = schedule6w[day];
  }
  // 6 tuần sau: lặp lại nhưng shift rotation
  for (let day = 1; day <= 42; day++) {
    const shifted = schedule6w[((day - 1 + 7) % 42) + 1]; // shift 1 tuần
    schedule[day + 42] = shifted;
  }

  return schedule;
}

// ============================================
// HELPER: Lấy thông tin workout cho 1 ngày
// ============================================
interface VideoInfo {
  id: string;
  nameEn: string;
  nameVi: string;
  vimeoUrl: string | null;
  duration: number;
  focus: string;
}

export function getDayWorkout(programSlug: string, dayNumber: number) {
  let schedule: Record<number, { videos: (BasicVideoId | AdvancedVideoId)[], type: 'main' | 'recovery' | 'review' }>;

  if (programSlug === 'bodix-21') schedule = getBodix21Schedule();
  else if (programSlug === 'bodix-6w') schedule = getBodix6WSchedule();
  else if (programSlug === 'bodix-12w') schedule = getBodix12WSchedule();
  else schedule = getBodix21Schedule();

  const day = schedule[dayNumber];
  if (!day) return null;

  // Lấy video objects
  const allVideos: Record<string, VideoInfo> = { ...WORKOUT_VIDEOS, ...ADVANCED_VIDEOS };
  const videos = day.videos.map((id) => allVideos[id]).filter(Boolean);

  const singleDuration = 7; // phút/lượt/video
  const videoCount = videos.length;

  // Tạo title tiếng Việt
  let title: string;
  if (day.type === 'review') {
    title = 'Review Chủ nhật';
  } else if (day.type === 'recovery') {
    title = 'Phục hồi & Linh hoạt';
  } else if (videoCount === 1) {
    title = videos[0].nameVi;
  } else {
    title = videos.map((v) => v.nameVi).join(' + ');
  }

  return {
    dayNumber,
    type: day.type as 'main' | 'recovery' | 'review',
    videos,
    videoCount,
    title,
    titleEn: day.type === 'review' ? 'Sunday Review' : day.type === 'recovery' ? 'Recovery & Mobility' : videos.map((v) => v.nameEn).join(' + '),
    focus: videos.map((v) => v.focus).join(' | '),
    duration: {
      hard: videoCount * singleDuration * 3,
      light: videoCount * singleDuration * 2,
      easy: videoCount * singleDuration * 1,
      recovery: singleDuration,
    },
  };
}
