const download = document.querySelector('#download-link');
const status = document.querySelector('#release-status');

fetch('https://api.github.com/repos/MGN-Consultancy/TerrainFoundry/releases?per_page=100', {
  headers: { Accept: 'application/vnd.github+json' }
}).then(response => {
  if (!response.ok) throw new Error('Release list is unavailable.');
  return response.json();
}).then(releases => {
  const candidates = releases
    .filter(release => !release.draft && !release.prerelease && release.published_at)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  for (const release of candidates) {
    const asset = release.assets?.find(item => /^TerrainFoundryLauncher-\d+\.\d+\.\d+-win-x64\.msi$/.test(item.name));
    if (!asset) continue;

    const url = new URL(asset.browser_download_url);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/MGN-Consultancy/TerrainFoundry/releases/download/')) continue;

    status.textContent = `Latest release: ${release.tag_name} · Launcher installer ${(asset.size / 1048576).toFixed(1)} MB. The launcher downloads the editor and scenery separately.`;
    download.textContent = 'Download for Windows ↓';
    download.href = url.href;
    download.setAttribute('download', asset.name);
    return;
  }

  status.textContent = 'The Windows installer is temporarily unavailable. Please try again shortly.';
  download.removeAttribute('href');
  download.setAttribute('aria-disabled', 'true');
}).catch(() => {
  status.textContent = 'The Windows installer could not be checked. Please try again shortly.';
  download.removeAttribute('href');
  download.setAttribute('aria-disabled', 'true');
});
