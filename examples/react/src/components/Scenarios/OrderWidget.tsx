/** Throws while rendering, which is the one kind of error a boundary can see. */
export const OrderWidget = ({ isBroken }: { isBroken: boolean }) => {
  if (isBroken) {
    throw new Error("The widget could not render");
  }
  return (
    <div className="widget-preview">
      <span className="widget-check" aria-hidden="true">
        ✓
      </span>
      <div>
        <strong>Order summary</strong>
        <span>The widget is rendering normally.</span>
      </div>
      <span className="healthy-label">Healthy</span>
    </div>
  );
};
