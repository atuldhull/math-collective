import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AsymptoteCurve } from "@/components/lamp";
import Button from "@/components/ui/Button";
import LiveStage from "./LiveStage";

export default function EndedScreen({ errorMsg, onLeave }) {
  return (
    <LiveStage tone="violet" center>
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 18 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1000 }}
        className="lamp-panel lamp-panel--lit w-full max-w-md px-6 py-10 text-center sm:px-10"
      >
        {/* The curve runs out toward a line it never reaches: the session is over. */}
        <AsymptoteCurve tone="violet" className="mx-auto h-14 w-48" />
        <h2 className="lamp-display mt-6 text-3xl text-text-primary">
          Session ended
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {errorMsg || "The host has ended this quiz session."}
        </p>
        <div className="mt-8">
          <Button onClick={onLeave} leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}>
            Join another quiz
          </Button>
        </div>
      </motion.div>
    </LiveStage>
  );
}
