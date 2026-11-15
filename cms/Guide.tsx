// "Start here": the first thing Pomi sees in the Studio. Plain instructions, no jargon.
const box: React.CSSProperties = { maxWidth: 640, padding: "24px 28px", lineHeight: 1.6, fontSize: 15 };
const h: React.CSSProperties = { fontSize: 17, margin: "28px 0 8px" };

export function Guide() {
  return (
    <div style={box}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Editing the website</h1>
      <p>Everything on pomibrow.com that changes lives here. You can't break the design: if something won't fit, the editor tells you before you publish.</p>

      <h2 style={h}>Change something</h2>
      <ol>
        <li>Pick what to change on the left: the Home page, a service, an article…</li>
        <li>Make your change. It's saved as a draft as you type. Nothing is live yet.</li>
        <li>Click <strong>Publish</strong> (bottom right). The website updates about two minutes later.</li>
      </ol>

      <h2 style={h}>See it before you publish</h2>
      <p>
        Click <strong>Preview</strong> at the top of the screen. The real website opens beside your fields, showing your unpublished changes, and
        refreshes as you type. Click any text on the page to jump to the field that controls it. Visitors don't see any of it until you
        publish.
      </p>

      <h2 style={h}>Where things are</h2>
      <ul>
        <li><strong>Home page</strong>: the headline, the photo wall and the section headings.</li>
        <li><strong>Services &amp; prices</strong>: each service's name, price, photos and page. A new service gets its own page automatically.</li>
        <li><strong>Learn articles</strong>: the questions and guides. Tick “Show as a question on the home page” to put one there.</li>
        <li><strong>Pages</strong>: Safety and Aftercare.</li>
        <li><strong>Reviews</strong>: copy them word for word from Yelp or Google. Never write one yourself.</li>
        <li><strong>Studio details</strong>: phone, address, hours, booking link, Instagram, Yelp numbers and your bio.</li>
      </ul>

      <h2 style={h}>Photos</h2>
      <ul>
        <li>To change a photo, click it and choose <strong>Replace</strong>. Fill in “Describe the photo”.</li>
        <li>To choose what stays in view when a frame crops the photo, click the photo, then the crop icon, and drag the circle onto the brows, eyes or lips.</li>
      </ul>

      <h2 style={h}>If something looks wrong</h2>
      <ul>
        <li>A red message means the change can't be published yet; it says what to fix.</li>
        <li>Made a mistake? Every document keeps its history: open the ⋯ menu → <strong>Review changes</strong> to go back.</li>
        <li>Not live after five minutes? Check you clicked Publish, not just saved a draft.</li>
      </ul>
    </div>
  );
}
