using System;
using BepInEx;
using BepInEx.Logging;
using UnityEngine;

namespace NoApModule
{
    // A separate BepInEx plugin, not part of NOXMFD.dll: it registers the AP page with NOXMFD's
    // public Api, reads NOAutopilot through NoApBridge, and applies the page's commands through
    // NoApCommands (docs/noautopilot-plan.md).
    [BepInPlugin("com.roque.noautopilot-module", "NOXMFD: NOAutopilot Extension", MyPluginInfo.PLUGIN_VERSION)]
    // 0.58.0 carries extension API version 7: the WPT route reads and SetActiveRouteNextIndex that
    // NoApRoute couples NOAutopilot to.
    [BepInDependency("com.roque.NOXMFD", "0.58.0")]
    // Soft: load after NOAutopilot when it's installed, but still load without it.
    [BepInDependency(NoApBridge.NoApGuid, BepInDependency.DependencyFlags.SoftDependency)]
    [BepInProcess("NuclearOption.exe")]
    public class Plugin : BaseUnityPlugin
    {
        internal const string ExtId = "noap";
        internal static ManualLogSource? Log;

        // Matches NOXMFD's 10 Hz frame, so every frame carries a fresh slice.
        private const float PublishInterval = 0.1f;
        private float _nextPublish;
        private bool _registered;

        private void Awake()
        {
            Log = Logger;
            _registered = NOXMFD.Api.RegisterExtension(ExtId, "AUTO PILOT", NoApPageAssets.Resolve, NoApCommands.Handle);
            if (!_registered)
            {
                Log.LogError("[NOAP] failed to register with NOXMFD (id already taken?); extension disabled.");
                return;
            }
            Log.LogInfo("NOAutopilot extension loaded.");
        }

        private void Update()
        {
            if (!_registered) return;
            // Every frame, not at the publish rate: NOAutopilot drops reached points from its own
            // per-frame update, and each drop has to reach NOXMFD's route before the next one.
            if (NoApBridge.IsLinked)
            {
                try { NoApRoute.Tick(); }
                catch (Exception ex) { NoApBridge.Fail("route coupling", ex); }
            }
            if (Time.unscaledTime < _nextPublish) return;
            _nextPublish = Time.unscaledTime + PublishInterval;
            NOXMFD.Api.PublishSlice(ExtId, NoApBridge.BuildSliceJson());
        }

        // Hands "Cycle wp" back to the pilot's setting, since NOAutopilot persists it to its config.
        private void OnDestroy()
        {
            try { NoApRoute.Decouple(); }
            catch (Exception ex) { Log?.LogWarning($"[NOAP] decoupling on shutdown failed: {ex.Message}"); }
        }
    }
}
