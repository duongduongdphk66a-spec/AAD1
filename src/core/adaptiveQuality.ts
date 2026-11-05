export type QualityMode = 'auto' | 'high' | 'low';

export class AdaptiveQuality {
  private ema: number;
  private cooldown = 0;
  scale: number;

  constructor(
    private readonly min: number,
    private readonly max: number,
    private readonly targetMs = 1000 / 60
  ) {
    this.scale = max;
    this.ema = targetMs;
  }

  /** Gọi mỗi khung hình; trả về pixelRatio mới khi cần đổi, ngược lại null. */
  update(dtMs: number): number | null {
    if (this.max <= this.min) return null;
    this.ema = this.ema * 0.95 + Math.min(Math.max(dtMs, 0), 100) * 0.05;
    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    let next = this.scale;
    if (this.ema > this.targetMs * 1.25) {
      const factor = Math.max(0.8, Math.sqrt(this.targetMs / this.ema));
      next = Math.max(this.min, this.scale * factor);
    } else if (this.ema < this.targetMs * 1.05) {
      next = Math.min(this.max, this.scale * 1.05);
    }
    if (Math.abs(next - this.scale) < 1e-9) return null;
    this.scale = next;
    this.cooldown = 45;
    return next;
  }
}
