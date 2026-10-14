import { useEffect, useRef, useState } from "react";
import { cloudinaryImg, cloudinaryVideoPoster } from "@/lib/cloudinary";
import useGalleryReveals from "./useGalleryReveals";
import "./gallery.css";
import { treasureFiles, inaugurationFiles } from "./galleryMedia";

const groups = [
  { title: "Treasure Hunt", subtitle: "Follow the clues. Find your people.", files: treasureFiles },
  { title: "Inauguration", subtitle: "Where it all began. Our first chapter, together.", files: inaugurationFiles },
];
const images = groups.flatMap(({ files }) => files.filter(({ type }) => type === "img"));

export default function GuestGallery() {
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const collection = useRef(null);
  useGalleryReveals(collection);
  useEffect(() => {
    if (selected !== null && !dialog.current.open) dialog.current.showModal();
    if (selected === null && dialog.current.open) dialog.current.close();
  }, [selected]);
  const move = (direction) => setSelected((index) => (index + direction + images.length) % images.length);
  return (
    <div className="mc-gallery-editorial" ref={collection}>
      <header className="mc-gallery-heading">
        <p className="mc-eyebrow">LIFE AT ASYMPTOTES</p>
        <h1>
          More than equations.
          <br />
          <em>Shared experiences.</em>
        </h1>
        <p>The people, the discoveries, and everything in between.</p>
        <nav className="mc-gallery-index" aria-label="Gallery collections">
          {groups.map((group, i) => (
            <a href={"#gallery-" + i} key={group.title}>
              <span>0{i + 1}</span>
              {group.title}
              <small>{group.files.length} moments ↘</small>
            </a>
          ))}
        </nav>
      </header>
      {groups.map(({ title, subtitle, files }, index) => (
        <section className="mc-gallery-section" key={title} id={"gallery-" + index}>
          <div className="mc-section-heading">
            <div>
              <p className="mc-eyebrow">0{index + 1} / THE COLLECTIVE IN FOCUS</p>
              <h2>{title}</h2>
            </div>
            <p>{subtitle}</p>
          </div>
          <div className="mc-gallery-grid">
            {files.map((file, mediaIndex) => (
              <figure
                key={file.url}
                data-gallery-frame={mediaIndex % 10}
                data-media={file.type}
                style={{ "--frame-index": mediaIndex % 3 }}
              >
                {file.type === "img" ? (
                  <button
                    className="mc-gallery-window"
                    onClick={() => setSelected(images.findIndex(({ url }) => url === file.url))}
                    aria-label={`Open ${title}: ${file.label}`}
                  >
                    <img
                      src={cloudinaryImg(file.url, mediaIndex % 10 === 7 ? 1400 : mediaIndex % 10 === 0 ? 1100 : 700)}
                      alt={`${title} — ${file.label}`}
                      loading="lazy"
                      decoding="async"
                      width="700"
                      height="525"
                    />
                    <span className="mc-gallery-open" aria-hidden="true">
                      Explore ↗
                    </span>
                  </button>
                ) : (
                  <video
                    src={file.url}
                    poster={cloudinaryVideoPoster(file.url, 700)}
                    controls
                    playsInline
                    preload="none"
                    aria-label={`${title} — ${file.label}`}
                  />
                )}
                <figcaption>
                  <b className="mc-gallery-number">{String(mediaIndex + 1).padStart(2, "0")}</b>
                  {file.label}
                  <span>{file.type === "vid" ? "FILM" : "PHOTO"}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <dialog
        className="mc-gallery-dialog"
        ref={dialog}
        aria-label="Club photo viewer"
        onClose={() => setSelected(null)}
        onCancel={() => setSelected(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") move(1);
          if (event.key === "ArrowLeft") move(-1);
        }}
      >
        {selected !== null && (
          <>
            <img src={cloudinaryImg(images[selected].url, 1800, { quality: "best" })} alt={images[selected].label} />
            <div className="mc-gallery-dialog-controls">
              <button onClick={() => move(-1)} aria-label="Previous image">
                ←
              </button>
              <p>
                {images[selected].label} · {selected + 1} / {images.length}
              </p>
              <button onClick={() => move(1)} aria-label="Next image">
                →
              </button>
              <button onClick={() => setSelected(null)} aria-label="Close lightbox">
                Close ×
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
