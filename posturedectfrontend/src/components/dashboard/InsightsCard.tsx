import { PostureData } from "@/types/posture";
import { Lightbulb } from "lucide-react";

function getInsight(data: PostureData): { text: string; tip: string } {
  if (data.posture_score >= 85)
    return {
      text: "Great work maintaining posture!",
      tip: "Remember to take a quick stretch break every hour.",
    };
  if (data.neck_bad)
    return {
      text: "Your neck is leaning forward.",
      tip: "Pull your chin back and align your ears directly over your shoulders.",
    };
  if (data.spine_bad)
    return {
      text: "Your spine is misaligned.",
      tip: "Sit upright with your back fully supported by your chair back.",
    };
  if (data.leaning)
    return {
      text: `You're leaning to the ${data.leaning_direction?.toLowerCase()}.`,
      tip: "Shift your weight to center and balance both feet flat on the floor.",
    };
  if (data.head_tilt)
    return {
      text: "Your head is tilted.",
      tip: "Level your gaze and gently relax your neck muscles.",
    };
  return {
    text: "Keep it up!",
    tip: "Consistent good posture reduces long-term back and neck pain significantly.",
  };
}

export default function InsightsCard({ data }: { data: PostureData }) {
  const { text, tip } = getInsight(data);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={18} className="text-yellow-500" />
        <h2 className="text-lg font-semibold text-gray-800">Insights</h2>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">{text}</p>
      <p className="text-sm text-gray-500 leading-relaxed">{tip}</p>
    </div>
  );
}
