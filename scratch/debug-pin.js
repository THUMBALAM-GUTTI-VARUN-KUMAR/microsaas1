async function test() {
  const url = 'https://in.pinterest.com/pin/men-fashion-styles-omarspaneshi--290130401012188065/';
  console.log('Testing URL:', url);
  
  // Pin ID match test
  const pinIdMatch = url.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);
  console.log('PinId Match:', pinIdMatch ? pinIdMatch[1] : 'none');

  // oEmbed test with canonical pin URL
  const canonicalPinUrl = `https://www.pinterest.com/pin/${pinIdMatch ? pinIdMatch[1] : ''}/`;
  console.log('Canonical Pin URL:', canonicalPinUrl);

  const oembedRes = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonicalPinUrl)}`);
  console.log('oEmbed status:', oembedRes.status);
  if (oembedRes.ok) {
    const oembedJson = await oembedRes.json();
    console.log('oEmbed data:', oembedJson);
  }

  // HTML Fetch test
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }
  });

  console.log('Final URL:', res.url);
  const html = await res.text();
  
  const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  console.log('og:image in HTML:', ogImg ? ogImg[1] : 'null');
  
  const title = html.match(/<title>(.*?)<\/title>/i);
  console.log('Title in HTML:', title ? title[1] : 'null');

  // Check for pin JSON or images in HTML
  const allImgs = [...html.matchAll(/https:\/\/i\.pinimg\.com\/(?:originals|\d+x)\/[a-zA-Z0-9_\-\/]+\.(?:jpg|jpeg|png|webp)/g)];
  console.log('All pinimg images found in HTML (top 5):', allImgs.slice(0, 5).map(m => m[0]));
}

test().catch(console.error);
