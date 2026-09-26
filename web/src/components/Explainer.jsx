export function Explainer({ reportCount }) {
  return (
    <>
      <div className="explainer">
        <b>A little context goes a long way.</b>
        <p>
          <b>FPI</b> means foreign portfolio investors. <b>Net flow</b> is their investment minus withdrawals—not gross purchases or sales. <b>AUC</b> is the value of holdings at the end of a period; it also changes with market prices. Figures are in ₹ crore.
        </p>
      </div>
      <footer>
        <span>Source: your uploaded NSDL reports · {reportCount} periods</span>
        <span>Historical data, not investment advice.</span>
      </footer>
    </>
  );
}
