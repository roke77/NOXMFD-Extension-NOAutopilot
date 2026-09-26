using System;
using System.IO;
using System.Reflection;

namespace NoApModule
{
    // Embedded web assets for the AP page, the same suffix-match pattern NOXMFD's own pages and its
    // other extensions use (EXTENSIONS.md, "2. Serving your page"). Runs on an HTTP worker, so it
    // touches nothing but this assembly's resources.
    internal static class NoApPageAssets
    {
        private static readonly Assembly Asm = typeof(NoApPageAssets).Assembly;

        internal static byte[]? Resolve(string relPath)
        {
            string name = string.IsNullOrEmpty(relPath) ? "noap.html" : relPath;
            string suffix = "." + ("web." + name).Replace('/', '.');
            foreach (string n in Asm.GetManifestResourceNames())
            {
                if (!n.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) continue;
                using Stream? s = Asm.GetManifestResourceStream(n);
                if (s == null) return null;
                var ms = new MemoryStream();
                s.CopyTo(ms);
                return ms.ToArray();
            }
            return null;
        }
    }
}
