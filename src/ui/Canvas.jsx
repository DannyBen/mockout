export function Canvas() {
  return <>
  <main id="workspace" tabIndex="-1" aria-label="Mock canvas">
    <div id="canvas" aria-label="Boxes"></div>
    <svg id="style-guides" aria-hidden="true" hidden></svg>
    <div id="style-markers" role="group" aria-label="Box style targets" hidden></div>
  </main>
  </>;
}
