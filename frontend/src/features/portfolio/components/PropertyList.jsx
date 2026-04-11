import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { formatMoney } from '../../../utils/currencies';

const TYPE_LABELS = { flat: 'Flat', house: 'House' };

export function PropertyList({ properties, onRefresh, fullWidth, readOnly }) {
    const { openInspector } = useInspector();

    return (
        <div className={`portfolio-section ${fullWidth ? 'portfolio-section-full' : ''}`}>
            <h2 className="section-title">
                <Building2 size={20} />
                Properties
                <span className="section-count">{properties.length}</span>
            </h2>

            {properties.length === 0 ? (
                <div className="portfolio-empty">
                    <Building2 size={32} />
                    <p>No properties yet.</p>
                    <p className="empty-hint">Click "Add Property" to start tracking real estate investments.</p>
                </div>
            ) : (
                <div className="portfolio-cards">
                    {properties.map(prop => {
                        const hasValue = prop.display_value != null;
                        const isPositive = prop.gain_loss != null && prop.gain_loss >= 0;

                        return (
                            <div
                                key={prop.id}
                                className="portfolio-card property-card"
                                onClick={readOnly ? undefined : () => openInspector('portfolio-property-form', { property: prop })}
                            >
                                <div className="card-top-row">
                                    <div className="card-color-dot" style={{ background: prop.color || '#f97316' }} />
                                    <span className="card-name">{prop.name}</span>
                                    <span className="type-badge">{TYPE_LABELS[prop.property_type] || prop.property_type}</span>
                                </div>
                                <div className="card-ticker">
                                    {prop.city && <span>{prop.city}</span>}
                                    {prop.city && prop.square_meters && <span> · </span>}
                                    <span>{Number(prop.square_meters)} m²</span>
                                    {prop.rooms && <span> · {prop.rooms} rooms</span>}
                                </div>
                                <div className="card-features">
                                    {prop.has_balcony && <span className="feature-tag">Balcony</span>}
                                    {prop.has_garden && <span className="feature-tag">Garden</span>}
                                    {prop.has_parking && <span className="feature-tag">Parking</span>}
                                </div>
                                <div className="card-balance">
                                    {hasValue
                                        ? `${formatMoney(prop.display_value)} ${prop.currency}`
                                        : `${formatMoney(prop.purchase_price)} ${prop.currency} (cost)`
                                    }
                                </div>
                                {hasValue ? (
                                    <div className={`card-gain ${isPositive ? 'positive' : 'negative'}`}>
                                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        <span>
                                            {isPositive ? '+' : ''}{formatMoney(prop.gain_loss)} ({isPositive ? '+' : ''}{prop.gain_loss_pct}%)
                                        </span>
                                    </div>
                                ) : (
                                    <div className="card-gain neutral">
                                        <Minus size={14} />
                                        <span>No valuation set</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
