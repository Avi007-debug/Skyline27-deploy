import React, { useState, useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";

interface TypewriterProps {
  text: string;
  speed?: number; // ms per char (default: 22, caps/labels: 14)
  className?: string;
  triggerKey?: any;
  delay?: number;
  onComplete?: () => void;
}

export default function Typewriter({
  text,
  speed = 22,
  className = "",
  triggerKey,
  delay = 0,
  onComplete,
}: TypewriterProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();

  const [charIndex, setCharIndex] = useState(shouldReduceMotion ? text.length : 0);
  const [caretVisible, setCaretVisible] = useState(false);
  const [caretFading, setCaretFading] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setCharIndex(text.length);
      setCaretVisible(false);
      return;
    }

    if (!isInView) return;

    let timeoutId: any;
    let intervalId: any;
    let fadeTimeoutId: any;
    let removeTimeoutId: any;

    setCharIndex(0);
    setCaretVisible(true);
    setCaretFading(false);

    timeoutId = setTimeout(() => {
      let current = 0;
      intervalId = setInterval(() => {
        current += 1;
        setCharIndex(current);
        if (current >= text.length) {
          clearInterval(intervalId);
          if (onComplete) onComplete();
          fadeTimeoutId = setTimeout(() => {
            setCaretFading(true);
            removeTimeoutId = setTimeout(() => setCaretVisible(false), 500);
          }, 1200);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      clearTimeout(fadeTimeoutId);
      clearTimeout(removeTimeoutId);
    };
  }, [isInView, text, speed, triggerKey, shouldReduceMotion, delay]);

  const displayed = text.slice(0, charIndex);
  const remaining = text.slice(charIndex);

  return (
    <span ref={containerRef} className={className} aria-label={text}>
      <span>{displayed}</span>
      {caretVisible && (
        <span
          className={`inline-block w-[2px] ml-0.5 bg-current align-middle transition-opacity duration-500 ${
            caretFading ? "opacity-0" : "animate-pulse opacity-100"
          }`}
          style={{ height: "0.85em", verticalAlign: "-0.05em" }}
          aria-hidden="true"
        />
      )}
      <span className="invisible select-none pointer-events-none" aria-hidden="true">
        {remaining}
      </span>
    </span>
  );
}
