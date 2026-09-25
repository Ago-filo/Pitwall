import { useState } from "react";
import type { Comparison } from "./domain";
import { raceStory } from "./race-story";

export function RaceStoryView({
  comparison,
  onViewLap,
}: {
  comparison: Comparison;
  onViewLap: (lap: number) => void;
}) {
  const story = raceStory(comparison);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? story.moments : story.moments.slice(0, 7);
  const hiddenCount = story.moments.length - visible.length;

  return (
    <section className="race-story" aria-labelledby="race-story-title">
      <div className="panel-heading">
        <span>THE RECORDED SEQUENCE</span>
        <h3 id="race-story-title">Race story</h3>
        <p>
          A lap-ordered view of the first shared position sample, recorded pit
          stops, Safety Car or red-flag messages, and DNF records. These are
          observed moments, not inferred causes or complete race phases.
        </p>
      </div>
      {story.moments.length > 0 ? (
        <ol className="story-list">
          {visible.map((moment) => (
            <li key={moment.lap} className="story-moment">
              <div className="story-lap" aria-label={"Lap " + moment.lap}>
                <span>LAP</span>
                <strong>{moment.lap}</strong>
              </div>
              <div className="story-content">
                <div className="story-tags">
                  {[
                    ...new Set(moment.signals.map((signal) => signal.kind)),
                  ].map((kind) => (
                    <span key={kind}>
                      {kind === "position" ? "REFERENCE" : kind.toUpperCase()}
                    </span>
                  ))}
                </div>
                <ul>
                  {moment.signals.map((signal, index) => (
                    <li key={signal.kind + index}>{signal.text}</li>
                  ))}
                </ul>
                {moment.observedPositions.length > 0 && (
                  <p className="story-positions">
                    Reconstructed position:{" "}
                    {moment.observedPositions
                      .map(({ acronym, position }) => acronym + " P" + position)
                      .join(" · ")}
                  </p>
                )}
                <button type="button" onClick={() => onViewLap(moment.lap)}>
                  VIEW LAP {moment.lap} ↗
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-inline">
          No lap-linked story moments are available.
        </p>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="story-expand"
          onClick={() => setExpanded(true)}
          aria-label={"Show " + hiddenCount + " more race story moments"}
        >
          SHOW ALL {story.moments.length} MOMENTS ↓
        </button>
      )}
      {expanded && story.moments.length > 7 && (
        <button
          type="button"
          className="story-expand"
          onClick={() => setExpanded(false)}
        >
          SHOW FEWER ↑
        </button>
      )}
      {story.unplacedControlCount > 0 && (
        <p className="story-caveat">
          {story.unplacedControlCount} notable race-control{" "}
          {story.unplacedControlCount === 1 ? "message has" : "messages have"}{" "}
          no usable lap number and cannot be placed here.
        </p>
      )}
      <div className="story-classification">
        <span>RECORDED CLASSIFICATION</span>
        <p>{story.classification.join("  /  ")}</p>
      </div>
      <p className="story-caveat">
        Positions are reconstructed near lap end; reported results are listed
        separately. Other recorded flags remain in the lap timeline.
      </p>
    </section>
  );
}
