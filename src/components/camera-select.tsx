"use client";
type Props = { devices: MediaDeviceInfo[]; deviceId: string; disabled: boolean; onChange: (id: string) => void };
export function CameraSelect({ devices, deviceId, disabled, onChange }: Props) {
  return <label className="camera-select">Camera
    <select aria-label="Choose camera" value={deviceId} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="">Automatic camera</option>
      {deviceId && !devices.some(device => device.deviceId === deviceId) && <option value={deviceId}>Previously selected camera</option>}
      {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
    </select>
  </label>;
}
