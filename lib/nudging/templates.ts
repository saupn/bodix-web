export interface NudgeVariant {
  id: string
  title: string
  body: string
}

export interface NudgeTemplate {
  variants: NudgeVariant[]
}

export const NUDGE_TEMPLATES: Record<string, NudgeTemplate> = {
  morning_reminder: {
    variants: [
      {
        id: 'mr_1',
        title: 'Ngày {day_number} đang chờ bạn',
        body: 'Chào {name}! Hôm nay là ngày {day_number}/{total_days} của hành trình {program_name}. Bài tập hôm nay: {workout_title} ({duration} phút). Sẵn sàng chứ? 💪',
      },
      {
        id: 'mr_2',
        title: 'Sáng nay tập gì nhỉ?',
        body: '{name} ơi, hôm nay là {workout_title}. Chỉ {duration} phút thôi. Nếu mệt, chọn Light cũng được nhé! 🌿',
      },
      {
        id: 'mr_3',
        title: '🔥 Streak {current_streak} ngày',
        body: 'Bạn đang giữ chuỗi {current_streak} ngày liên tiếp! Tiếp tục nào — ngày {day_number} đang đợi.',
      },
      {
        id: 'mr_4',
        title: 'Một ngày mới, một bước tiến mới',
        body: 'Đã {day_number}/{total_days} rồi đó! Mỗi ngày bạn tập là một ngày bạn gần hơn với phiên bản tốt nhất. Let\'s go! ✨',
      },
      {
        id: 'mr_5',
        title: '{cohort_today_count} người đã bắt đầu',
        body: 'Trong đợt của bạn, {cohort_today_count} người đã tập sáng nay rồi. Bạn sẵn sàng chứ? 🚀',
      },
    ],
  },

  evening_confirmation: {
    variants: [
      {
        id: 'ec_1',
        title: 'Check-in nào!',
        body: '{name} ơi, bạn đã tập hôm nay chưa? Nếu rồi, check-in để giữ streak 🔥 nhé!',
      },
      {
        id: 'ec_2',
        title: 'Đừng quên check-in',
        body: 'Ngày {day_number} sắp kết thúc. Check-in để ghi nhận thành quả hôm nay! Chỉ mất 10 giây thôi.',
      },
      {
        id: 'ec_3',
        title: 'Hôm nay thế nào?',
        body: 'Dù Hard, Light, hay Recovery — mỗi ngày bạn check-in đều đáng tự hào. ✅',
      },
    ],
  },

  rescue_soft: {
    variants: [
      {
        id: 'rs_1',
        title: 'Mọi thứ ổn chứ?',
        body: '{name} ơi, hôm qua bạn chưa tập. Không sao cả! Hôm nay thử Light mode — chỉ {light_duration} phút nhẹ nhàng nhé 🌿',
      },
      {
        id: 'rs_2',
        title: 'Nghỉ 1 ngày cũng được',
        body: 'Ai cũng có ngày mệt. Quan trọng là quay lại. Hôm nay có bài Recovery {recovery_duration} phút nếu bạn cần nhẹ nhàng.',
      },
    ],
  },

  rescue_urgent: {
    variants: [
      {
        id: 'ru_1',
        title: 'Đừng dừng lại ở đây',
        body: '{name}, bạn đã đi được {completed_days} ngày rồi. Đừng để streak đứt! Chỉ cần 10 phút Recovery hôm nay — giữ nhịp là đủ. 🙏',
      },
      {
        id: 'ru_2',
        title: 'BodiX nhớ bạn',
        body: '2 ngày rồi chưa gặp bạn. Chúng tôi biết cuộc sống bận rộn. Quay lại với bài 10 phút thôi nhé — mọi thứ vẫn ở đây chờ bạn.',
      },
    ],
  },

  rescue_critical: {
    variants: [
      {
        id: 'rc_1',
        title: 'Bạn vẫn ở đây',
        body: '{name}, bạn đã hoàn thành {completed_days}/{total_days} ngày. Hành trình vẫn đang chờ. Không cần bắt đầu lại — chỉ cần bước tiếp. Quay lại bất cứ lúc nào. ❤️',
      },
    ],
  },

  milestone_celebration: {
    variants: [
      {
        id: 'mc_1',
        title: '🎉 {milestone_label}!',
        body: 'Chúc mừng {name}! {milestone_description}. Bạn đang làm rất tốt! Tiếp tục nhé!',
      },
    ],
  },

  cohort_motivation: {
    variants: [
      {
        id: 'cm_1',
        title: 'Đợt của bạn đang tiến tốt!',
        body: '{cohort_today_count}/{cohort_total} người đã hoàn thành hôm nay. Completion rate tuần này: {weekly_rate}%. Cùng nhau nhé! 💪',
      },
    ],
  },
}
