import notificationSound from '@renderer/assets/notification.mp3'

let audio: HTMLAudioElement | null = null

// Plays the notification sound from the start; a new call restarts it instead of stacking.
export function playNotificationSound(): void {
  try {
    audio ??= new Audio(notificationSound)
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  } catch {
    // no audio device: the visual notification is enough
  }
}
