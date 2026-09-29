export interface Person {
  id: string;
  owner_id: string;
  linked_user_id: string | null;
  name: string;
  relationship: string;
  photo_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonInvite {
  id: string;
  person_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface Memory {
  id: string;
  person_id: string;
  creator_id: string;
  type: "photo" | "video" | "voice" | "text";
  media_url: string | null;
  duration_seconds: number | null;
  caption: string | null;
  memory_date: string;
  location: string | null;
  is_shared: boolean;
  circle_id: string | null;
  created_at: string;
  creator_name?: string;
}

export interface Circle {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface CirclePerson {
  id: string;
  circle_id: string;
  person_id: string;
  created_at: string;
}

export interface CircleMember {
  id: string;
  circle_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "member";
  status: "pending" | "accepted";
  joined_at: string | null;
  created_at: string;
  invited_by: string | null;
}

export interface CircleInvite {
  id: string;
  circle_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface ConnectionWithProfile {
  connectionUserId: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ChallengeTemplate {
  id: string;
  owner_id: string | null;
  title: string;
  description: string;
  category: string;
  suggested_type: "photo" | "video" | "voice" | "text";
}

export interface PersonChallenge {
  id: string;
  person_id: string;
  template_id: string;
  status: "pending" | "completed";
  completed_memory_id: string | null;
  created_at: string;
}