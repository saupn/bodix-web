export type CelebrationLevel = 'low' | 'medium' | 'high' | 'epic'

export interface MilestoneConfig {
  label: string
  emoji: string
  description: string
  celebration_level: CelebrationLevel
}

export const MILESTONE_CONFIG: Record<string, MilestoneConfig> = {
  first_checkin: {
    label: 'Bắt đầu rồi!',
    emoji: '🎯',
    description: 'Check-in đầu tiên của hành trình',
    celebration_level: 'low',
  },
  streak_3: {
    label: '3 ngày liên tiếp!',
    emoji: '✨',
    description: 'Ba ngày không nghỉ – thói quen đang hình thành',
    celebration_level: 'low',
  },
  streak_7: {
    label: '7 ngày liên tiếp!',
    emoji: '🔥',
    description: 'Một tuần không nghỉ – bạn đang nghiêm túc rồi đấy',
    celebration_level: 'medium',
  },
  streak_14: {
    label: '14 ngày liên tiếp!',
    emoji: '⚡',
    description: 'Hai tuần không nghỉ – thói quen đã được lập trình',
    celebration_level: 'medium',
  },
  streak_21: {
    label: '21 ngày liên tiếp!',
    emoji: '💎',
    description: 'Ba tuần không nghỉ – bạn đã tạo ra một con người mới',
    celebration_level: 'high',
  },
  week_complete: {
    label: 'Hoàn thành tuần!',
    emoji: '📅',
    description: 'Một tuần đầy đủ – không bỏ ngày nào',
    celebration_level: 'medium',
  },
  halfway: {
    label: 'Nửa hành trình!',
    emoji: '🏁',
    description: 'Bạn đã đi được nửa đường – đừng dừng lại',
    celebration_level: 'high',
  },
  final_week: {
    label: 'Tuần cuối cùng!',
    emoji: '🎽',
    description: 'Chỉ còn 1 tuần nữa – về đích thôi',
    celebration_level: 'high',
  },
  program_complete: {
    label: 'HOÀN THÀNH!',
    emoji: '🏆',
    description: 'Bạn đã đi đến cuối hành trình – không phải ai cũng làm được điều này',
    celebration_level: 'epic',
  },
  all_hard: {
    label: 'Tuần Hard toàn phần!',
    emoji: '💪',
    description: '7 buổi liên tiếp đều chọn Hard – bạn là người cứng đầu (theo nghĩa tốt)',
    celebration_level: 'medium',
  },
  comeback: {
    label: 'Comeback!',
    emoji: '🔄',
    description: 'Bạn đã quay lại sau khi gián đoạn – điều này còn khó hơn việc không bỏ lần đầu',
    celebration_level: 'medium',
  },
}
