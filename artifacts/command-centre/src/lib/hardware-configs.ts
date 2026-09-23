export const HARDWARE_CONFIGS = [
  {
    id: "INDUSTRIAL_MCU",
    label: "Industrial MCU / actuator controller",
    targetProfile: "FIRMWARE_MCU",
    standards: "IEC 60730-1 · IEC 61508",
    deviceClass: "industrial MCU actuator controller",
    customization:
      "Deterministic C/C++, watchdogs, bounded memory, hardware-in-the-loop seams, and a fail-safe actuator default.",
    baseline: {
      target_profile: "FIRMWARE_MCU",
      cardinality: "SINGLE",
      interlock_present: true,
      regulatory_regimes_named: ["IEC 60730-1", "IEC 61508"],
      platform_allocation: [
        { target: "MCU", language: "C/C++", framework: "bare-metal or safety RTOS" },
      ],
    },
  },
  {
    id: "ROBOTICS_RTCL",
    label: "Robotics real-time control loop",
    targetProfile: "ROBOTICS_RTCL",
    standards: "ISO 10218-1 · IEC 61508",
    deviceClass: "robotics real-time controller",
    customization:
      "Bounded RTOS tasks, explicit state machines, safety-rated stops, deterministic fieldbus boundaries, and no LLM in the control path.",
    baseline: {
      target_profile: "ROBOTICS_RTCL",
      cardinality: "SINGLE",
      interlock_present: true,
      regulatory_regimes_named: ["ISO 10218-1", "IEC 61508"],
      platform_allocation: [
        { target: "REAL_TIME_CONTROLLER", language: "C/C++", framework: "RTOS with deterministic scheduling" },
      ],
    },
  },
  {
    id: "APPLIANCE_FLEET",
    label: "Connected appliance fleet controller",
    targetProfile: "APPLIANCE_FLEET",
    standards: "IEC 60730-1 · ETSI EN 303 645",
    deviceClass: "connected appliance fleet controller",
    customization:
      "Signed OTA rollback, secure boot boundaries, fleet-safe configuration, telemetry isolation, and local fail-safe mode.",
    baseline: {
      target_profile: "APPLIANCE_FLEET",
      cardinality: "FLEET",
      interlock_present: false,
      regulatory_regimes_named: ["IEC 60730-1", "ETSI EN 303 645"],
      platform_allocation: [
        { target: "EDGE_MCU", language: "C/C++", framework: "RTOS with signed OTA updates" },
      ],
    },
  },
] as const;

export type HardwareConfigId = (typeof HARDWARE_CONFIGS)[number]["id"];

export function getHardwareConfig(id: string) {
  return HARDWARE_CONFIGS.find((config) => config.id === id);
}