// Next.js page that displays the camera scroll animation and the text panel below it.
import CameraScroll from "./CameraScroll";

// Renders the scroll animation first, then the short content panel below it.
export default function Page() {
  return (
    <main className="next-site-shell">
      <CameraScroll />
      <section className="next-after-panel">
        <p>Always awake</p>
        <h1>
          A camera designed to disappear into the architecture.
        </h1>
        <p>
          Silent mechanics, precise optics, and a scroll-revealed construction
          that exposes every layer behind the watchful eye.
        </p>
      </section>
    </main>
  );
}
