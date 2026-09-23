export const HARDWARE_CONFIGS = {
  INDUSTRIAL_MCU: {
    id: "INDUSTRIAL_MCU",
    label: "Industrial MCU / actuator controller",
    targetProfile: "FIRMWARE_MCU",
    standards: ["IEC 60730-1", "IEC 61508"],
    cardinality: "SINGLE",
    interlockPresent: true,
    regulatoryRegimes: ["IEC 60730-1", "IEC 61508"],
    platformAllocation: [
      { target: "MCU", language: "C/C++", framework: "bare-metal or safety RTOS" },
    ],
    codeDjCustomization:
      "Prefer deterministic C/C++ control loops, watchdog supervision, bounded memory, hardware-in-the-loop seams, and a fail-safe actuator default.",
  },
  ROBOTICS_RTCL: {
    id: "ROBOTICS_RTCL",
    label: "Robotics real-time control loop",
    targetProfile: "ROBOTICS_RTCL",
    standards: ["ISO 10218-1", "IEC 61508"],
    cardinality: "SINGLE",
    interlockPresent: true,
    regulatoryRegimes: ["ISO 10218-1", "IEC 61508"],
    platformAllocation: [
      { target: "REAL_TIME_CONTROLLER", language: "C/C++", framework: "RTOS with deterministic scheduling" },
    ],
    codeDjCustomization:
      "Prefer bounded real-time tasks, explicit state machines, safety-rated stop handling, deterministic fieldbus boundaries, and no LLM in the control path.",
  },
  APPLIANCE_FLEET: {
    id: "APPLIANCE_FLEET",
    label: "Connected appliance fleet controller",
    targetProfile: "APPLIANCE_FLEET",
    standards: ["IEC 60730-1", "ETSI EN 303 645"],
    cardinality: "FLEET",
    interlockPresent: false,
    regulatoryRegimes: ["IEC 60730-1", "ETSI EN 303 645"],
    platformAllocation: [
      { target: "EDGE_MCU", language: "C/C++", framework: "RTOS with signed OTA updates" },
    ],
    codeDjCustomization:
      "Prefer signed OTA rollback, secure boot boundaries, fleet-safe configuration, telemetry isolation, rate-limited remote commands, and a local fail-safe mode.",
  },
} as const;

export type HardwareConfigId = keyof typeof HARDWARE_CONFIGS;

export function getHardwareConfig(id: string): (typeof HARDWARE_CONFIGS)[HardwareConfigId] | undefined {
  return HARDWARE_CONFIGS[id as HardwareConfigId];
}