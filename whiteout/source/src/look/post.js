// WHITEOUT look: post-chain knobs beyond what createPost reads from ART.grade (look-director owned).
// ART.post: volShaft (atmos-mode shadowed in-scatter depth), aoRadius / aoIntensity (contact shadow under crates,
// skids and tank saddles: the snow is bright and the sun weak, so AO carries the grounding).
export function applyPostLook(post, ART) {
  const P = ART.post || {};
  post.params.volShaft = P.volShaft ?? ART.vol?.shaft ?? 1;
  if (P.aoRadius != null) post.params.aoRadius = P.aoRadius;
  if (P.aoIntensity != null) post.params.aoIntensity = P.aoIntensity;
  if (P.bloomScatter != null) post.params.bloomScatter = P.bloomScatter;
  return post;
}
