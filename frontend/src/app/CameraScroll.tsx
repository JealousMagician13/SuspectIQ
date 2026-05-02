"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BACKGROUND = "#050505";

type FrameSet = {
  count: number;
  path: (index: number) => string;
};

const FRAME_SETS: FrameSet[] = [
  {
    count: 120,
    path: (index) =>
      `/ezgif-split/frame_${String(index).padStart(3, "0")}_delay-0.04s.webp`,
  },
  {
    count: 41,
    path: (index) =>
      `/ezgif-100e1b1828d8fe4a-jpg/ezgif-frame-${String(index + 1).padStart(
        3,
        "0",
      )}.jpg`,
  },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
) {
  const width = canvas.width;
  const height = canvas.height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;

  if (canvasRatio > imageRatio) {
    drawWidth = width;
    drawHeight = width / imageRatio;
  } else {
    drawHeight = height;
    drawWidth = height * imageRatio;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function StoryText({
  align,
  eyebrow,
  progress,
  range,
  title,
}: {
  align: "center" | "left" | "right";
  eyebrow?: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  range: [number, number, number, number];
  title: string;
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);

  const alignment =
    align === "left"
      ? "story-left"
      : align === "right"
        ? "story-right"
        : "story-center";

  return (
    <motion.div
      className={`next-story-text ${alignment}`}
      style={{ opacity }}
    >
      {eyebrow ? (
        <p>{eyebrow}</p>
      ) : null}
      <h2>{title}</h2>
    </motion.div>
  );
}

export default function CameraScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameRef = useRef(0);
  const [frameCount, setFrameCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    damping: 38,
    mass: 0.18,
    stiffness: 240,
  });

  const activeFrames = useMemo(() => Math.max(frameCount - 1, 1), [frameCount]);

  const renderFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const image = imagesRef.current[index];
    const context = canvas?.getContext("2d");

    if (!canvas || !context || !image) {
      return;
    }

    frameRef.current = index;
    drawCover(context, image, canvas);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    renderFrame(frameRef.current);
  }, [renderFrame]);

  useEffect(() => {
    let cancelled = false;

    async function preloadFrames() {
      setLoaded(false);
      setLoadProgress(0);

      const frameSet = await FRAME_SETS.reduce<Promise<FrameSet | null>>(
        async (selected, candidate) => {
          const resolved = await selected;
          if (resolved) {
            return resolved;
          }

          try {
            await loadImage(candidate.path(0));
            return candidate;
          } catch {
            return null;
          }
        },
        Promise.resolve(null),
      );

      const resolvedFrameSet = frameSet ?? FRAME_SETS[0];
      const loadedImages: HTMLImageElement[] = [];

      for (let index = 0; index < resolvedFrameSet.count; index += 1) {
        if (cancelled) {
          return;
        }

        try {
          const image = await loadImage(resolvedFrameSet.path(index));
          loadedImages[index] = image;
          setLoadProgress(Math.round(((index + 1) / resolvedFrameSet.count) * 100));
        } catch {
          break;
        }
      }

      if (cancelled || loadedImages.length === 0) {
        return;
      }

      imagesRef.current = loadedImages;
      setFrameCount(loadedImages.length);
      setLoaded(true);
      requestAnimationFrame(() => {
        resizeCanvas();
        renderFrame(0);
      });
    }

    preloadFrames();

    return () => {
      cancelled = true;
    };
  }, [renderFrame, resizeCanvas]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [loaded, resizeCanvas]);

  useEffect(() => {
    return smoothProgress.on("change", (latest) => {
      if (!loaded) {
        return;
      }

      const nextFrame = Math.min(
        activeFrames,
        Math.max(0, Math.round(latest * activeFrames)),
      );

      if (nextFrame !== frameRef.current) {
        requestAnimationFrame(() => renderFrame(nextFrame));
      }
    });
  }, [activeFrames, loaded, renderFrame, smoothProgress]);

  return (
    <section
      ref={containerRef}
      className="next-scroll-stage"
      aria-label="Exploded CCTV camera scroll sequence"
    >
      <div className="next-sticky-scene">
        <canvas
          ref={canvasRef}
          className="next-product-canvas"
          aria-hidden="true"
        />
        <div className="next-scene-vignette" />

        <header className="next-top-nav">
          <a className="next-brand" href="/" aria-label="Zenith home">
            ZENITH
          </a>
          <nav aria-label="Primary navigation">
            <a href="#account">Account</a>
            <a href="#cart">Cart</a>
            <span className="next-cart-icon" aria-hidden="true" />
          </nav>
        </header>

        {!loaded ? (
          <div className="next-loader">
            <div className="next-spinner" />
            <p>Loading {loadProgress}%</p>
          </div>
        ) : null}

        <div className="next-story-layer">
          <StoryText
            align="center"
            eyebrow="Pure Vision"
            progress={scrollYProgress}
            range={[0, 0.08, 0.2, 0.3]}
            title="Zenith X"
          />
          <StoryText
            align="left"
            eyebrow="Optics"
            progress={scrollYProgress}
            range={[0.22, 0.32, 0.43, 0.52]}
            title="Precision Engineering."
          />
          <StoryText
            align="right"
            eyebrow="Inside"
            progress={scrollYProgress}
            range={[0.5, 0.6, 0.72, 0.8]}
            title="components."
          />
          <StoryText
            align="center"
            eyebrow="Command the room"
            progress={scrollYProgress}
            range={[0.78, 0.9, 0.98, 1]}
            title="Hear Everything."
          />
        </div>
      </div>
    </section>
  );
}

export { CameraScroll as HeadphoneScroll };
