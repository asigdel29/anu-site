// Maps island mesh names to what a click does and what the hover label says.
// Keys are substrings of GLB node names; tests/contract.test.js keeps them in sync with the model.

/** Click action, hover label and intro pop-in flag for each interactive object on the island. */
export const interactions = {
  Phone: { label: "work", modal: "work", intro: true },
  Name_Letter: { label: "about", modal: "about" },
  Anu_Figure: { label: "that's me", modal: "about" },
  Paper_Airplane: { label: "say hey", modal: "contact", intro: true },
  Writing_: { label: "writing", url: "https://sigdel29.substack.com", intro: true },
  Robot_Hand: {
    label: "ai blackjack dealer",
    url: "https://devpost.com/software/blackjack-dealer",
    intro: true,
  },
  Stone_GitHub: { label: "github", url: "https://github.com/asigdel29", intro: true },
  Stone_LinkedIn: {
    label: "linkedin",
    url: "https://www.linkedin.com/in/asigdel/",
    intro: true,
  },
  Stone_X: { label: "x", url: "https://x.com/sigdel29", intro: true },
  Minecraft_Block: { label: "my minecraft world", url: "https://sigdel.world", intro: true },
};

/** Returns the interaction for a mesh name, so one table drives clicks, labels and tests. */
export function findInteraction(meshName) {
  const match = Object.entries(interactions).find(([key]) =>
    meshName.includes(key)
  );
  return match?.[1];
}

/** Returns the 1-based letter number of a `Name_Letter_N` mesh, or null for other meshes. */
export function letterNumber(meshName) {
  const match = meshName.match(/Name_Letter_(\d+)/);
  return match ? Number(match[1]) : null;
}
