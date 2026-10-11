import { type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';

const VARIANTS = {
  initial:  { opacity: 0, y: 10, scale: 0.99 },
  animate:  { opacity: 1, y: 0,  scale: 1    },
  exit:     { opacity: 0, y: -6, scale: 0.99 },
};

const TRANSITION = {
  duration: 0.28,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

interface PageTransitionProps {
  children: ReactNode;
  /** If true, skip the animation (e.g. the big dashboard that does its own animation). */
  skip?: boolean;
}

/**
 * Wraps a page in a smooth fade+slide+scale transition.
 * Use around the content of each route to get between-page animations.
 */
export function PageTransition({ children, skip = false }: PageTransitionProps) {
  const { pathname } = useLocation();

  if (skip) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={TRANSITION}
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Simple section-level entrance animation for cards and panels within a page.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
