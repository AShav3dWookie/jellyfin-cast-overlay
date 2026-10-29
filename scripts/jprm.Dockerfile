# .NET 10 SDK plus jprm, Jellyfin's plugin packaging tool. Used by scripts/release.sh.
FROM mcr.microsoft.com/dotnet/sdk:10.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

# The image's Python is externally managed (PEP 668), so jprm goes in a venv.
RUN python3 -m venv /opt/jprm \
 && /opt/jprm/bin/pip install --no-cache-dir jprm==1.1.0

ENV PATH="/opt/jprm/bin:${PATH}" \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1
