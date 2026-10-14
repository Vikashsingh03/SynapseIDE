import { resolveFileIcon, resolveFolderIcon } from '../utils/fileIconMap';

// Real Material Icon Theme SVGs (the icons VS Code uses), bundled locally
// in src/assets/file-icons/ — see MATERIAL-ICON-THEME-LICENSE.txt there.
const URLS = {};
const modules = import.meta.glob('../assets/file-icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
for (const [filePath, url] of Object.entries(modules)) {
  const base = filePath.split('/').pop().replace(/\.svg$/, '');
  URLS[base] = url;
}

export default function FileIcon({ name, size = 18, folder = false, open = false }) {
  const iconName = folder ? resolveFolderIcon(name, open) : resolveFileIcon(name);
  const src = URLS[iconName] || URLS.file;
  if (!src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}
