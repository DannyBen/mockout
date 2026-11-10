export function Icon({ name, ...props }) {
  return <svg className="icon" aria-hidden="true" {...props}><use href={`assets/material-symbols/sprite.svg#${name}`} /></svg>;
}
