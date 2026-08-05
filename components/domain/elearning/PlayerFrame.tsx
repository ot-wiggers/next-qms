"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type StartData = {
  participantId: Id<"trainingParticipants">;
  progress: number;
  userName: string;
  packageUrl: string | null;
};

/**
 * postMessage-Protokoll mit dem eingebetteten E-Learning-Paket:
 * Host→Paket: {type:"ki-schulung:init", userName, progress}
 * Paket→Host: {type:"ki-schulung:ready"}
 *             {type:"ki-schulung:progress", level}
 *             {type:"ki-schulung:completed", score, maxScore}
 *             {type:"ki-schulung:bogen", data:{shortReport, organizationRatings, organizationRatingsNa, eventRatings, badRatingReason?}}
 * Host→Paket (Fehler bei einer Mutation): {type:"ki-schulung:error", message}
 */
export function PlayerFrame({ trainingId }: { trainingId: Id<"trainings"> }) {
  const start = useMutation(api.elearning.start);
  const reportProgress = useMutation(api.elearning.reportProgress);
  const complete = useMutation(api.elearning.complete);
  const submitFeedback = useMutation(api.elearning.submitFeedback);
  const [data, setData] = useState<StartData | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    start({ trainingId }).then(setData);
  }, [trainingId, start]);

  useEffect(() => {
    if (!data) return;

    const postToFrame = (message: unknown) =>
      frameRef.current?.contentWindow?.postMessage(message, "*");

    const onMessage = async (e: MessageEvent) => {
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;
      const m = e.data;
      try {
        if (m?.type === "ki-schulung:ready") {
          postToFrame({ type: "ki-schulung:init", userName: data.userName, progress: data.progress });
        }
        if (m?.type === "ki-schulung:progress") {
          await reportProgress({ participantId: data.participantId, level: m.level });
        }
        if (m?.type === "ki-schulung:completed") {
          await complete({ participantId: data.participantId, score: m.score, maxScore: m.maxScore });
        }
        if (m?.type === "ki-schulung:bogen") {
          await submitFeedback({ participantId: data.participantId, ...m.data });
        }
      } catch (err) {
        postToFrame({ type: "ki-schulung:error", message: String(err instanceof Error ? err.message : err) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [data, reportProgress, complete, submitFeedback]);

  if (!data) return <p className="p-8 text-sm text-muted-foreground">Schulung wird geladen …</p>;
  if (!data.packageUrl) return <p className="p-8 text-sm">Für diese Schulung ist noch kein Paket hinterlegt.</p>;
  return (
    <iframe
      ref={frameRef}
      src={data.packageUrl}
      sandbox="allow-scripts allow-modals"
      className="h-[calc(100vh-8rem)] w-full rounded-lg border"
      title="E-Learning"
    />
  );
}
