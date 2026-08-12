export type Announcement = {
  id: string;
  tag: string;
  tagTone: "error" | "primary";
  timeAgo: string;
  title: string;
  excerpt: string;
};

export type Activity = {
  id: string;
  title: string;
  date: string;
  location: string;
  points: number;
  imageUrl: string;
  imageAlt: string;
  participantAvatars: string[];
  extraParticipants: number;
};

export type LeaderboardEntry = {
  id: string;
  rank: number;
  name: string;
  department: string;
  score: number;
  avatarUrl: string;
  isTop?: boolean;
};

export const MOCK_USER = {
  name: "Minh Anh",
  score: 1250,
  rank: 12,
  newActivitiesCount: 2,
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    tag: "Khẩn cấp",
    tagTone: "error",
    timeAgo: "2 giờ trước",
    title: "Cập nhật Quy định Bảo hiểm 2024",
    excerpt:
      "Các thay đổi quan trọng về mức đóng bảo hiểm y tế đã được thông qua bởi Công đoàn...",
  },
  {
    id: "2",
    tag: "Bầu cử",
    tagTone: "primary",
    timeAgo: "Hôm qua",
    title: "Đề cử Đại diện Công đoàn cơ sở",
    excerpt:
      "Hãy tham gia đề cử những gương mặt ưu tú cho nhiệm kỳ 2024-2026 ngay hôm nay.",
  },
];

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: "1",
    title: "Chạy bộ từ thiện 2024",
    date: "15/10/2024",
    location: "Công viên Thống Nhất",
    points: 200,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA1wtWPeBzDu-EUS2f282aGUtU1Cs8yvh_CmoJxECbnLCW4Y60CrP6n6A9D7GWDr1Iz4OvYwKg_b42Drz3wftnkmOejNefM93xMzUrx5lFypDcM6liWObAw1UpOqV9IqdPuaZ6NwFDTW8Pgh-Fsev91XsXzi-gYjUeinSUip3DMwyla0ljB-jfwJg-mRSqiMox6PvNQTuTa63f7kIKHsEQ3bxzCJcbfOMGEzXW1gsRwxd9HACCmlX56pUEWicYzQuT1s5VMzJw_RHQ",
    imageAlt: "Nhóm nhân viên tham gia chạy bộ từ thiện ngoài trời",
    participantAvatars: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDcxxkVUxDRwD_QQyBNa114LRp2ZtFbKY9RJhBWjPcbNbWpRhF0NdwwhlMQACCqQD4w_lXrMR0I237sTlao7XHrzdYT3YU4DC2DQPT1qaJUosdCTo7_r9serDX1UZmYFnGG4RjrnrO0hjT1aB1wGBoqXw0AX3HQCnH6eJARgzrS6UR3qxgszExJpJbA-hORA0hLffy2Mqb1FBj3XdcuyV6fNmaBFlq8GT0bq_qrAS49w6T-IuPtAwI4nxBJNEcNOP4ZjxP-6ljTWhk",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD0HpjsqB7nIgOqQ2o7_uCgidE2Q1OxST3m5IB21ltcZbXq0UfS11KMzwqm5Tb6V9ZHy_JcIDTN1DYsQ17OLfFi4-FX4ttypJpmlqQzk1qYnQPpmps8PXgjCqOl1nYvThrZ9AGnluxEK4trYI_4fS7HGTs3nvTvJKP4KkvV2LXdsuSEzy2riewgjk2zGfIot4IWXHvS6SRBwOKb0Ug3RBob21cZXocE-EzQzzPOgDWIMr0r7NnBIDp9FyPUIKW0fJxJ2Eu2dboLPtw",
    ],
    extraParticipants: 45,
  },
  {
    id: "2",
    title: "Hội thảo Kỹ năng Đàm phán",
    date: "20/10/2024",
    location: "Phòng họp lớn 2",
    points: 150,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA2-cOA603njhNtLLpGRfNnqnFQcJ56DxXnfjC4mW6S7l4wBQW125L_qE08TDTSpCSBJYSMBf7YcrKQxHze-fOCzUn2OdkUaNq4BlTEKgxh4nF7KKDqZ4TdpAjL5dT68notDgK-dISYhIqB1pF0808xrlXmXmkjeaXBw8deTTd3KCtNPX9xE1Qu-5CgDAxWjRk9nsF7r2ECgVfXiE4mds67_clREFSVGslTNgMc_XZlIWr17nitcJ1Wjb7c4QSoj8fMeokS8RKFLPA",
    imageAlt: "Hội thảo kỹ năng trong phòng họp hiện đại",
    participantAvatars: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDggcG2Y7SGL6TbdxENsWpIFPSyZ_aWnsOCah0YXK2UxHeFUgKdktaXVlu-6u_JxRtXWtiLl1IMQVptx32o2K-RivftAqwECgjZzsvi5UyGcGg3b_iDkz5NNt8dN0iGXxqMAhK5KVhokIuWWhvJTw4k0Nj0v1T3udb-ZlINhA8P77r5usbwmVj1FoCCZU5DK-C_95SddQD1-1ZB7w0oxhUsXw_k00RTq2DhZ_dDkttv3nPv6ZcVoZoYKDBkDB8zisnfm-85bfOUrgE",
    ],
    extraParticipants: 12,
  },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: "1",
    rank: 1,
    name: "Trần Thanh Tùng",
    department: "Khối Công nghệ",
    score: 2840,
    avatarUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA-dOPsCyoGOOJB3mRGZcPYbTyxQY1cjL57mpE5uTt-c6AKONJRVU4pRKzpWDJOQhjG6bo4Y_dvEQ_SYVfH3s3zML6Ci9mNT8cpMhX-OlfzkowpMoB0Jcui4aCcKoe5llaXVxxNrGLnYyT6b5YU90iKuNgbblMIz_VY9s7yHp0j5YVtH9hJqMeNIddtozs9dguf36wZjWOvhmnz9HOJsmHBCseA3-8TW6tAb4aTF7-8IVVEO5gzssEc-SxpGK6QiNod1e91B6lHT28",
    isTop: true,
  },
  {
    id: "2",
    rank: 2,
    name: "Lê Thị Mai",
    department: "Khối Tài chính",
    score: 2150,
    avatarUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAkqQkfCBfiuaTD5QSM4zQ0vjDElsAo1KHcEfr8CUo6Pse37lAE84OBQUFn2wUPKnVg7FDSXIrH8wmR-7WVoYW5Gsj9r0YQ28F59BOGVT9VrIVbIEQjIi1pI0h6tmrJpZf8F-Xwlq_-GwkDAfkaEbiC-Eio1hz2pcGFZyAbooSryEL7YgNVsxNKnpjZxZs2aSZ1nNVH4QONUmdTNoRSu703rfXBh50ukWkHI1q2QsaRSQVDT4OaTw1XJzjS-GyCmFGQlgTwFyjwRO0",
  },
];

export const MOCK_GOAL = {
  title: "Sát hạch quý 4",
  progress: 85,
  note: "Chỉ còn 150 điểm nữa để đạt hạng Kim cương.",
};
