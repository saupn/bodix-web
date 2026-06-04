export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ab_test_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          test_name: string
          user_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          test_name: string
          user_id: string
          variant: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          test_name?: string
          user_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_reports: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          report_date: string
          report_type: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          report_date: string
          report_type: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          report_date?: string
          report_type?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      affiliate_profiles: {
        Row: {
          affiliate_tier: string | null
          approved_at: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          pending_balance: number | null
          social_channels: Json | null
          total_earned: number | null
          total_paid: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          affiliate_tier?: string | null
          approved_at?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          pending_balance?: number | null
          social_channels?: Json | null
          total_earned?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          affiliate_tier?: string | null
          approved_at?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          pending_balance?: number | null
          social_channels?: Json | null
          total_earned?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string
          current_members: number
          end_date: string
          id: string
          max_members: number
          name: string
          program_id: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          current_members?: number
          end_date: string
          id?: string
          max_members?: number
          name: string
          program_id: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          current_members?: number
          end_date?: string
          id?: string
          max_members?: number
          name?: string
          program_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_program_analytics"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          cohort_id: string | null
          content: string | null
          created_at: string | null
          id: string
          is_hidden: boolean | null
          is_pinned: boolean | null
          likes_count: number | null
          media_urls: string[] | null
          milestone_type: string | null
          post_type: string
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          likes_count?: number | null
          media_urls?: string[] | null
          milestone_type?: string | null
          post_type: string
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          likes_count?: number | null
          media_urls?: string[] | null
          milestone_type?: string | null
          post_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "mv_cohort_analytics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_milestones: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          enrollment_id: string
          id: string
          metadata: Json | null
          milestone_type: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          enrollment_id: string
          id?: string
          metadata?: Json | null
          milestone_type: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          enrollment_id?: string
          id?: string
          metadata?: Json | null
          milestone_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_milestones_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          cohort_id: string | null
          completed_at: string | null
          created_at: string | null
          day_number: number
          duration_minutes: number | null
          enrollment_id: string
          feeling: number | null
          feeling_note: string | null
          id: string
          mode: string
          user_id: string
          workout_date: string
        }
        Insert: {
          cohort_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          day_number: number
          duration_minutes?: number | null
          enrollment_id: string
          feeling?: number | null
          feeling_note?: string | null
          id?: string
          mode: string
          user_id: string
          workout_date: string
        }
        Update: {
          cohort_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          day_number?: number
          duration_minutes?: number | null
          enrollment_id?: string
          feeling?: number | null
          feeling_note?: string | null
          id?: string
          mode?: string
          user_id?: string
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checkins_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "mv_cohort_analytics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "daily_checkins_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dropout_signals: {
        Row: {
          created_at: string | null
          details: Json | null
          enrollment_id: string
          id: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number | null
          signal_date: string
          signal_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          enrollment_id: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          signal_date: string
          signal_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          enrollment_id?: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          signal_date?: string
          signal_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropout_signals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropout_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          amount_paid: number | null
          cohort_id: string | null
          completed_at: string | null
          created_at: string
          current_day: number
          enrolled_at: string
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          program_id: string
          referral_code_id: string | null
          referral_discount_amount: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          cohort_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_day?: number
          enrolled_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          program_id: string
          referral_code_id?: string | null
          referral_discount_amount?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          cohort_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_day?: number
          enrolled_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          program_id?: string
          referral_code_id?: string | null
          referral_discount_amount?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "mv_cohort_analytics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_program_analytics"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mid_program_reflections: {
        Row: {
          before_photo_url: string | null
          created_at: string | null
          enrollment_id: string
          goal_still_relevant: boolean | null
          id: string
          midpoint_photo_url: string | null
          original_goal: string | null
          overall_progress: number | null
          recommendation_score: number | null
          submitted_at: string | null
          updated_goal: string | null
          user_id: string
          visible_changes: string[] | null
          wants_intensity_change: string | null
          what_to_improve: string | null
          what_works_well: string | null
          would_recommend: boolean | null
        }
        Insert: {
          before_photo_url?: string | null
          created_at?: string | null
          enrollment_id: string
          goal_still_relevant?: boolean | null
          id?: string
          midpoint_photo_url?: string | null
          original_goal?: string | null
          overall_progress?: number | null
          recommendation_score?: number | null
          submitted_at?: string | null
          updated_goal?: string | null
          user_id: string
          visible_changes?: string[] | null
          wants_intensity_change?: string | null
          what_to_improve?: string | null
          what_works_well?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          before_photo_url?: string | null
          created_at?: string | null
          enrollment_id?: string
          goal_still_relevant?: boolean | null
          id?: string
          midpoint_photo_url?: string | null
          original_goal?: string | null
          overall_progress?: number | null
          recommendation_score?: number | null
          submitted_at?: string | null
          updated_goal?: string | null
          user_id?: string
          visible_changes?: string[] | null
          wants_intensity_change?: string | null
          what_to_improve?: string | null
          what_works_well?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "mid_program_reflections_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mid_program_reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          community_updates: boolean | null
          created_at: string | null
          evening_confirmation: boolean | null
          evening_time: string | null
          id: string
          marketing_emails: boolean | null
          morning_reminder: boolean | null
          morning_time: string | null
          preferred_channel: string | null
          rescue_messages: boolean | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          community_updates?: boolean | null
          created_at?: string | null
          evening_confirmation?: boolean | null
          evening_time?: string | null
          id?: string
          marketing_emails?: boolean | null
          morning_reminder?: boolean | null
          morning_time?: string | null
          preferred_channel?: string | null
          rescue_messages?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          community_updates?: boolean | null
          created_at?: string | null
          evening_confirmation?: boolean | null
          evening_time?: string | null
          id?: string
          marketing_emails?: boolean | null
          morning_reminder?: boolean | null
          morning_time?: string | null
          preferred_channel?: string | null
          rescue_messages?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json
          read_at: string | null
          sent_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          channel: string
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          read_at?: string | null
          sent_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          read_at?: string | null
          sent_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nudge_logs: {
        Row: {
          channel: string
          clicked: boolean | null
          content_template: string | null
          content_variables: Json | null
          created_at: string | null
          delivered: boolean | null
          enrollment_id: string | null
          id: string
          led_to_checkin: boolean | null
          nudge_type: string
          opened: boolean | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          channel: string
          clicked?: boolean | null
          content_template?: string | null
          content_variables?: Json | null
          created_at?: string | null
          delivered?: boolean | null
          enrollment_id?: string | null
          id?: string
          led_to_checkin?: boolean | null
          nudge_type: string
          opened?: boolean | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          clicked?: boolean | null
          content_template?: string | null
          content_variables?: Json | null
          created_at?: string | null
          delivered?: boolean | null
          enrollment_id?: string | null
          id?: string
          led_to_checkin?: boolean | null
          nudge_type?: string
          opened?: boolean | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudge_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          fitness_goal: string | null
          full_name: string | null
          gender: string | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          phone_verified: boolean
          role: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          fitness_goal?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          phone_verified?: boolean
          role?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          fitness_goal?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          phone_verified?: boolean
          role?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          name: string
          price_usd: number | null
          price_vnd: number
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_usd?: number | null
          price_vnd: number
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_usd?: number | null
          price_vnd?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          enrollment_id: string
          id: string
          is_public: boolean | null
          notes: string | null
          photo_type: string
          photo_url: string
          uploaded_at: string | null
          user_id: string
          week_number: number | null
        }
        Insert: {
          enrollment_id: string
          id?: string
          is_public?: boolean | null
          notes?: string | null
          photo_type: string
          photo_url: string
          uploaded_at?: string | null
          user_id: string
          week_number?: number | null
        }
        Update: {
          enrollment_id?: string
          id?: string
          is_public?: boolean | null
          notes?: string | null
          photo_type?: string
          photo_url?: string
          uploaded_at?: string | null
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          code_type: string
          commission_rate: number | null
          commission_type: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          referee_reward_type: string | null
          referee_reward_value: number | null
          reward_type: string | null
          reward_value: number | null
          total_clicks: number | null
          total_conversions: number | null
          total_revenue_generated: number | null
          total_signups: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          code_type: string
          commission_rate?: number | null
          commission_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          referee_reward_type?: string | null
          referee_reward_value?: number | null
          reward_type?: string | null
          reward_value?: number | null
          total_clicks?: number | null
          total_conversions?: number | null
          total_revenue_generated?: number | null
          total_signups?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          code_type?: string
          commission_rate?: number | null
          commission_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          referee_reward_type?: string | null
          referee_reward_value?: number | null
          reward_type?: string | null
          reward_value?: number | null
          total_clicks?: number | null
          total_conversions?: number | null
          total_revenue_generated?: number | null
          total_signups?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          approved_at: string | null
          created_at: string | null
          id: string
          paid_at: string | null
          referral_tracking_id: string | null
          reward_description: string | null
          reward_type: string
          reward_value: number
          status: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          referral_tracking_id?: string | null
          reward_description?: string | null
          reward_type: string
          reward_value: number
          status?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          referral_tracking_id?: string | null
          reward_description?: string | null
          reward_type?: string
          reward_value?: number
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_tracking_id_fkey"
            columns: ["referral_tracking_id"]
            isOneToOne: false
            referencedRelation: "referral_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_tracking: {
        Row: {
          clicked_at: string | null
          conversion_amount: number | null
          converted_at: string | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          program_id: string | null
          referral_code_id: string
          referral_device: string | null
          referral_ip: string | null
          referral_source: string | null
          referred_id: string | null
          referrer_id: string
          signed_up_at: string | null
          status: string | null
        }
        Insert: {
          clicked_at?: string | null
          conversion_amount?: number | null
          converted_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          program_id?: string | null
          referral_code_id: string
          referral_device?: string | null
          referral_ip?: string | null
          referral_source?: string | null
          referred_id?: string | null
          referrer_id: string
          signed_up_at?: string | null
          status?: string | null
        }
        Update: {
          clicked_at?: string | null
          conversion_amount?: number | null
          converted_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          program_id?: string | null
          referral_code_id?: string
          referral_device?: string | null
          referral_ip?: string | null
          referral_source?: string | null
          referred_id?: string | null
          referrer_id?: string
          signed_up_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_tracking_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_tracking_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_program_analytics"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "referral_tracking_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_tracking_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_tracking_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_tracking_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rescue_interventions: {
        Row: {
          action_taken: string
          created_at: string | null
          enrollment_id: string
          id: string
          message_sent: string | null
          outcome: string | null
          outcome_at: string | null
          risk_score_at_trigger: number | null
          trigger_reason: string
          user_id: string
        }
        Insert: {
          action_taken: string
          created_at?: string | null
          enrollment_id: string
          id?: string
          message_sent?: string | null
          outcome?: string | null
          outcome_at?: string | null
          risk_score_at_trigger?: number | null
          trigger_reason: string
          user_id: string
        }
        Update: {
          action_taken?: string
          created_at?: string | null
          enrollment_id?: string
          id?: string
          message_sent?: string | null
          outcome?: string | null
          outcome_at?: string | null
          risk_score_at_trigger?: number | null
          trigger_reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rescue_interventions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rescue_interventions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          current_streak: number | null
          enrollment_id: string
          id: string
          last_checkin_date: string | null
          longest_streak: number | null
          streak_started_at: string | null
          total_completed_days: number | null
          total_hard_days: number | null
          total_light_days: number | null
          total_recovery_days: number | null
          total_skip_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          enrollment_id: string
          id?: string
          last_checkin_date?: string | null
          longest_streak?: number | null
          streak_started_at?: string | null
          total_completed_days?: number | null
          total_hard_days?: number | null
          total_light_days?: number | null
          total_recovery_days?: number | null
          total_skip_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          enrollment_id?: string
          id?: string
          last_checkin_date?: string | null
          longest_streak?: number | null
          streak_started_at?: string | null
          total_completed_days?: number | null
          total_hard_days?: number | null
          total_light_days?: number | null
          total_recovery_days?: number | null
          total_skip_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_activities: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json
          program_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json
          program_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_activities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_program_analytics"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "trial_activities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          transaction_type: string
          user_id: string
          withdrawal_status: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type: string
          user_id: string
          withdrawal_status?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
          withdrawal_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          avg_feeling: number | null
          biggest_challenge: string | null
          body_changes: string | null
          created_at: string | null
          difficulty_rating: number | null
          enrollment_id: string
          fatigue_level: number | null
          id: string
          intensity_adjustment: string | null
          next_week_goal: string | null
          progress_feeling: number | null
          submitted_at: string | null
          system_suggestion: string | null
          user_id: string
          week_completion_rate: number | null
          week_hard_count: number | null
          week_light_count: number | null
          week_number: number
          week_recovery_count: number | null
          week_skip_count: number | null
        }
        Insert: {
          avg_feeling?: number | null
          biggest_challenge?: string | null
          body_changes?: string | null
          created_at?: string | null
          difficulty_rating?: number | null
          enrollment_id: string
          fatigue_level?: number | null
          id?: string
          intensity_adjustment?: string | null
          next_week_goal?: string | null
          progress_feeling?: number | null
          submitted_at?: string | null
          system_suggestion?: string | null
          user_id: string
          week_completion_rate?: number | null
          week_hard_count?: number | null
          week_light_count?: number | null
          week_number: number
          week_recovery_count?: number | null
          week_skip_count?: number | null
        }
        Update: {
          avg_feeling?: number | null
          biggest_challenge?: string | null
          body_changes?: string | null
          created_at?: string | null
          difficulty_rating?: number | null
          enrollment_id?: string
          fatigue_level?: number | null
          id?: string
          intensity_adjustment?: string | null
          next_week_goal?: string | null
          progress_feeling?: number | null
          submitted_at?: string | null
          system_suggestion?: string | null
          user_id?: string
          week_completion_rate?: number | null
          week_hard_count?: number | null
          week_light_count?: number | null
          week_number?: number
          week_recovery_count?: number | null
          week_skip_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reviews_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          day_number: number
          day_of_week: number
          description: string | null
          duration_minutes: number
          exercises: Json | null
          id: string
          program_id: string
          sort_order: number
          title: string
          week_number: number
          workout_type: string
        }
        Insert: {
          created_at?: string
          day_number: number
          day_of_week: number
          description?: string | null
          duration_minutes: number
          exercises?: Json | null
          id?: string
          program_id: string
          sort_order?: number
          title: string
          week_number: number
          workout_type: string
        }
        Update: {
          created_at?: string
          day_number?: number
          day_of_week?: number
          description?: string | null
          duration_minutes?: number
          exercises?: Json | null
          id?: string
          program_id?: string
          sort_order?: number
          title?: string
          week_number?: number
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_program_analytics"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "workout_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_cohort_analytics: {
        Row: {
          avg_current_streak: number | null
          cohort_id: string | null
          cohort_name: string | null
          cohort_status: string | null
          completed_enrollments: number | null
          completion_rate: number | null
          current_members: number | null
          d14_adherence: number | null
          d7_adherence: number | null
          dropped_enrollments: number | null
          duration_days: number | null
          end_date: string | null
          max_streak: number | null
          program_name: string | null
          program_slug: string | null
          start_date: string | null
          total_enrollments: number | null
        }
        Relationships: []
      }
      mv_monthly_revenue: {
        Row: {
          avg_order_value: number | null
          month: string | null
          referral_purchases: number | null
          referral_revenue: number | null
          referral_share_percent: number | null
          total_discount_given: number | null
          total_purchases: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      mv_program_analytics: {
        Row: {
          avg_nps_score: number | null
          duration_days: number | null
          name: string | null
          nps: number | null
          overall_completion_rate: number | null
          price_vnd: number | null
          program_id: string | null
          slug: string | null
          total_completed: number | null
          total_enrollments: number | null
          total_revenue: number | null
          visible_change_rate: number | null
        }
        Relationships: []
      }
      mv_upgrade_funnel: {
        Row: {
          completers: number | null
          path: string | null
          upgrade_rate: number | null
          upgraded: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_risk_score: {
        Args: { p_enrollment_id: string }
        Returns: number
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_cohort_completion: { Args: { p_cohort_id: string }; Returns: Json }
      get_completion_rate: { Args: { p_enrollment_id: string }; Returns: Json }
      get_credit_balance: { Args: { p_user_id: string }; Returns: number }
      get_dropout_hotspots: {
        Args: { p_program_id: string }
        Returns: {
          day_number: number
          dropout_count: number
          dropout_rate: number
          total_reached: number
        }[]
      }
      refresh_analytics_views: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
