
// Base UIShape and Registry logic
export * from "./UIShape";

// Side-effect imports to trigger registration
import "./RectShape";
import "./CircleShape";
import "./DiamondShape";
import "./TextShape";
import "./ImageShape";
import "./GroupShape";
import "./LineShape";
import "./PathShape";
import "./CurveShape";
import "./TableShape";
import "./ConnectionShape";

export * from "./Scene";
