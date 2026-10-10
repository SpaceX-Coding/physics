# Human silhouettes on a small LED grid

Yes: a 16 × 16 display can represent recognisable large body poses; an 8 × 8 display gives a much coarser approximation. The camera measures the scene and the software processes it. The LED grid only displays the result.

| Movement or detail | 8 × 8 — 64 LEDs | 16 × 16 — 256 LEDs |
|---|---|---|
| Moving left and right | Visible | Visible |
| Raising both arms | Basic indication | More recognisable |
| Arms stretched sideways | Rough shape | More distinct |
| Leaning or bending | Limited detail | Easier to distinguish |
| Individual fingers or facial expressions | Too coarse | Still too coarse |

These are design expectations, not measured recognition guarantees. Results depend on framing, contrast, segmentation quality and the position of the shape relative to the pixel grid.

## Silhouette following versus recognising gestures

**Silhouette following:** the outline changes with the person's pose, as in the reference effect. The provided camera prototype is intended for this style of display. No list of poses needs to be programmed for an outline to change.

**Gesture recognition:** software classifies a pose, such as a raised hand, and triggers an action or displays a symbol. Even a small grid can show that symbol, but recognition requires an additional software model or explicit pose rules. The current code does not implement that classifier.

## Camera setup

Keep the full body and outstretched arms inside the camera crop. Arrange the camera so the person occupies much of that crop without clipping hands or feet. Use stable lighting and a contrasting background, and capture the empty scene before entering.

The existing Python prototype holds its background fixed until B is pressed, so a stationary person is not automatically learned into the background. Similar clothing/background colours, shadows, camera movement and exposure changes remain limitations.

## Current implementation limits

- The interactive preview currently contains a toy-car model; human pose presets have not been implemented in it.
- The supplied camera-to-LED protocol and Arduino sketch are fixed to 16 × 16.
- The 8 × 8 preview setting changes the simulation only; adapting physical hardware also requires matching Python/Arduino dimensions, packed-frame length, mapping and power limits.
- A 32 × 32 preview does not imply that the provided Uno R3 firmware or power design supports a 32 × 32 physical panel.

Changing from a car to a person does not inherently require a more expensive display. Changing the display's pixel count can. For the ₹1,000 budget, reusing a laptop, webcam, Arduino and suitable power source is central to evaluating an 8 × 8 build.
