import { useState } from "react";
import { coverGradient, safeImageUrl } from "../lib/format";

/** Capa da campanha: imagem validada ou gradiente de fallback. */
export default function Cover({ id, imageUrl, className = "", children }) {
  const [failed, setFailed] = useState(false);
  const src = safeImageUrl(imageUrl);
  return (
    <div className={`cover ${className}`} style={{ background: coverGradient(id) }}>
      {src && !failed && (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      )}
      {children}
    </div>
  );
}
