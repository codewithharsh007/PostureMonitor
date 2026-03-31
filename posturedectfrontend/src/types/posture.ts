export interface PostureData {
  timestamp: number;
  posture_score: number;
  neck_bad: boolean;
  spine_bad: boolean;
  leaning: boolean;
  leaning_direction: string | null;
  head_tilt: boolean;
  neck_forward_x: number;
  neck_forward_z: number;
  spine_angle_val: number;
  lean_angle_val: number;
  bad_posture_duration: number;
}

export const defaultPostureData: PostureData = {
  timestamp: 0,
  posture_score: 100,
  neck_bad: false,
  spine_bad: false,
  leaning: false,
  leaning_direction: null,
  head_tilt: false,
  neck_forward_x: 0,
  neck_forward_z: 0,
  spine_angle_val: 0,
  lean_angle_val: 0,
  bad_posture_duration: 0,
};
