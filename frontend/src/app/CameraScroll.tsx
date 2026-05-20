"use client";

// Client-side animation component that draws camera frames on a canvas as the page scrolls.
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Background color used when clearing the canvas before drawing each frame.
const BACKGROUND = "#050505";

// Describes one folder of animation frames and how to build each file path.
type FrameSet = {
  count: number;
  path: (index: number) => string;
};

// Possible frame folders; the component picks the first one that loads.
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

// Loads one image and resolves only after the browser has it ready.
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// Draws an image so it fills the canvas without leaving empty borders.
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

// Displays text overlays that fade in and out based on scroll progress.
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
  // Maps the scroll range for this caption into an opacity value.
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);

  // Chooses the CSS class that places the caption on the left, right, or center.
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

// Main scroll scene: preloads frames, draws them to canvas, and syncs frame index to scroll.
export default function CameraScroll() {
  // Refs store DOM nodes and frame state without causing React re-renders.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameRef = useRef(0);
  const [frameCount, setFrameCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Tracks how far the user has scrolled through the sticky animation section.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooths the raw scroll value so frame changes feel less jumpy.
  const smoothProgress = useSpring(scrollYProgress, {
    damping: 38,
    mass: 0.18,
    stiffness: 240,
  });

  // Last drawable frame index; kept at least 1 to avoid divide-by-zero style issues.
  const activeFrames = useMemo(() => Math.max(frameCount - 1, 1), [frameCount]);

  // Draws the requested frame onto the current canvas.
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

  // Resizes the canvas for the current viewport and redraws the current frame.
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

  // Loads all animation frames once when the component mounts.
  useEffect(() => {
    let cancelled = false;

    // Picks an available frame set, then loads its frames into memory.
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

      // Load frames in order so loading progress can be shown accurately.
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

      // Waits for the browser layout before measuring and drawing the canvas.
      requestAnimationFrame(() => {
        resizeCanvas();
        renderFrame(0);
      });
    }

    preloadFrames();

    // Prevents state updates if the component unmounts during image loading.
    return () => {
      cancelled = true;
    };
  }, [renderFrame, resizeCanvas]);

  // Keeps the canvas size correct after frames are loaded and when the window resizes.
  useEffect(() => {
    if (!loaded) {
      return;
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [loaded, resizeCanvas]);

  // Converts scroll progress into a frame number and redraws when it changes.
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

  // The returned markup layers the canvas, navigation, loader, and scroll text.
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
