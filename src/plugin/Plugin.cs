using BepInEx;
using BepInEx.Logging;
using UnityEngine;

namespace NoApModule
{
    // A separate BepInEx plugin, not part of NOXMFD.dll: it registers the AP page with NOXMFD's
    // public Api, reads NOAutopilot through NoApBridge, and applies the page's commands through
    // NoApCommands (docs/noautopilot-plan.md).
    [BepInPlugin("com.roque.noautopilot-module", "NOXMFD: NOAutopilot Extension", MyPluginInfo.PLUGIN_VERSION)]
    // 0.58.0 carries extension API version 7 (the WPT route reads). Phase 1 doesn't use them, but
    // pinning it now keeps Phase 2 from raising the requirement (plan, "Architecture").
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
            if (!_registered || Time.unscaledTime < _nextPublish) return;
            _nextPublish = Time.unscaledTime + PublishInterval;
            NOXMFD.Api.PublishSlice(ExtId, NoApBridge.BuildSliceJson());
        }
    }
}
