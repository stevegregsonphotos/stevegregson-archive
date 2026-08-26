"use client";

type ProofingGalleryWelcomeProps = {
  title: string;
  introMessage?: string;
  onContinue: () => void;
};

export default function ProofingGalleryWelcome({
  title,
  introMessage,
  onContinue,
}: ProofingGalleryWelcomeProps) {
  return (
    <section className="proofing-welcome">
      <div className="proofing-welcome-inner">
        <p className="proofing-client-eyebrow">
          Private Client Gallery
        </p>

        <h1>{title}</h1>

        {introMessage ? (
          <p className="proofing-welcome-message">
            {introMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onContinue}
          className="proofing-welcome-button"
        >
          Enter gallery
        </button>
      </div>
    </section>
  );
}