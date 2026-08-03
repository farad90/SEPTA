import { AuthImage } from "../ui/AuthImage";
import { BroadcastMessage } from "../../pages/broadcast-messages/broadcast-messages-api";

export function BroadcastPopup({
  broadcast,
  onClose,
  closing,
}: {
  broadcast: BroadcastMessage;
  onClose: () => void;
  closing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-lg overflow-hidden bg-surface shadow-modal animate-pop-in">
        {broadcast.imageUrl && (
          <AuthImage
            fileUrl={broadcast.imageUrl}
            alt=""
            className="w-full object-cover"
            style={{ height: "50vh" }}
          />
        )}
        <div className="p-5 space-y-4">
          <p className="text-sm leading-relaxed text-textPrimary whitespace-pre-wrap">{broadcast.message}</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              disabled={closing}
              className="text-xs px-4 py-2.5 rounded-lg text-white bg-primary font-medium disabled:opacity-60"
            >
              {closing ? "..." : "متوجه شدم"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
