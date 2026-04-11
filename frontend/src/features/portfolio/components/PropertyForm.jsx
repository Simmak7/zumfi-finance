import React, { useState, useEffect } from 'react';
import { Save, Trash2, Loader2 } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import {
    createPropertyInvestment, updatePropertyInvestment,
    deletePropertyInvestment, getPropertyBasePrices,
} from '../../../services/api';
import { formatMoney } from '../../../utils/currencies';
import { PropertyValueChart } from './PropertyValueChart';
import { useTranslation } from '../../../i18n';

const PRESET_COLORS = ['#f97316', '#ef4444', '#6366f1', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#64748b'];
const CURRENCIES = ['CZK', 'EUR', 'USD', 'GBP', 'PLN', 'HUF', 'UAH'];

const PROPERTY_TYPES = [
    { value: 'flat', label: 'Flat / Apartment' },
    { value: 'house', label: 'House' },
];

const RENOVATION_STATES = [
    { value: 'new', label: 'New / Renovated' },
    { value: 'good', label: 'Good condition' },
    { value: 'needs_renovation', label: 'Needs renovation' },
];

const FLOORS = [
    { value: 'ground', label: 'Ground floor' },
    { value: 'middle', label: 'Middle floor' },
    { value: 'top', label: 'Top floor' },
];

export function PropertyForm({ property, onSuccess }) {
    const { closeInspector } = useInspector();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const isEdit = !!property;
    const [loading, setLoading] = useState(false);
    const [basePrices, setBasePrices] = useState(null);
    const [formData, setFormData] = useState({
        name: property?.name || '',
        property_type: property?.property_type || 'flat',
        country: property?.country || 'Czech Republic',
        city: property?.city || '',
        address: property?.address || '',
        square_meters: property?.square_meters ?? '',
        rooms: property?.rooms ?? '',
        has_balcony: property?.has_balcony ?? false,
        has_garden: property?.has_garden ?? false,
        has_parking: property?.has_parking ?? false,
        renovation_state: property?.renovation_state || 'good',
        floor: property?.floor || '',
        purchase_price: property?.purchase_price ?? '',
        estimated_value: property?.estimated_value ?? '',
        currency: property?.currency || 'CZK',
        purchase_date: property?.purchase_date || '',
        notes: property?.notes || '',
        color: property?.color || PRESET_COLORS[0],
    });

    useEffect(() => {
        getPropertyBasePrices().then(setBasePrices).catch(() => {});
    }, []);

    // Resolve price/m2 automatically: city match -> country average -> null
    const resolvePrice = (country, city) => {
        if (!basePrices || !country) return null;
        const countryData = basePrices[country];
        if (!countryData) return null;

        if (city) {
            // Exact match
            if (countryData.cities?.[city]) {
                return { price: countryData.cities[city], currency: countryData.currency, source: city };
            }
            // Case-insensitive match
            const match = Object.keys(countryData.cities || {}).find(c => c.toLowerCase() === city.toLowerCase());
            if (match) {
                return { price: countryData.cities[match], currency: countryData.currency, source: match };
            }
        }
        // Country average fallback
        if (countryData.country_average) {
            return { price: countryData.country_average, currency: countryData.currency, source: `${country} average` };
        }
        return null;
    };

    const handleCityChange = (city) => {
        const updates = { city };
        const resolved = resolvePrice(formData.country, city);
        if (resolved) {
            updates.currency = resolved.currency;
        }
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleCountryChange = (country) => {
        setFormData(prev => {
            const updates = { country };
            if (country !== prev.country && basePrices?.[country]) {
                updates.city = '';
                updates.currency = basePrices[country].currency;
            }
            return { ...prev, ...updates };
        });
    };

    // Auto-resolve price per sqm from location
    const resolved = resolvePrice(formData.country, formData.city);
    const autoPricePerSqm = resolved ? resolved.price : 0;
    const priceSource = resolved ? resolved.source : null;

    // Compute live metrics
    const sqm = Number(formData.square_meters) || 0;
    const ppsqm = autoPricePerSqm;
    const purchasePrice = Number(formData.purchase_price) || 0;
    const manualEstimate = formData.estimated_value !== '' ? Number(formData.estimated_value) : null;

    let computedValue = null;
    if (manualEstimate != null) {
        computedValue = manualEstimate;
    } else if (sqm > 0 && ppsqm > 0) {
        computedValue = sqm * ppsqm;
        if (formData.has_balcony) computedValue *= 1.03;
        if (formData.has_garden) computedValue *= 1.07;
        if (formData.has_parking) computedValue *= 1.05;
        const renCoeff = { new: 1.0, good: 0.95, needs_renovation: 0.85 };
        computedValue *= renCoeff[formData.renovation_state] || 1.0;
        if (formData.property_type === 'flat' && formData.floor) {
            const floorCoeff = { ground: 0.95, middle: 1.0, top: 0.98 };
            computedValue *= floorCoeff[formData.floor] || 1.0;
        }
    }
    const gainLoss = computedValue != null && purchasePrice > 0 ? computedValue - purchasePrice : null;
    const gainPct = gainLoss != null && purchasePrice > 0 ? (gainLoss / purchasePrice) * 100 : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                square_meters: Number(formData.square_meters),
                rooms: formData.rooms !== '' ? Number(formData.rooms) : null,
                purchase_price: Number(formData.purchase_price),
                price_per_sqm: null,  // Auto-resolved by backend from location
                estimated_value: formData.estimated_value !== '' ? Number(formData.estimated_value) : null,
                floor: formData.floor || null,
                purchase_date: formData.purchase_date || null,
            };
            if (isEdit) {
                await updatePropertyInvestment(property.id, payload);
            } else {
                await createPropertyInvestment(payload);
            }
            window.dispatchEvent(new Event('portfolio-updated'));
            if (onSuccess) onSuccess();
            closeInspector();
        } catch (err) {
            console.error('Error saving property:', err);
            addToast(t('portfolioForm.failedToSave'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('portfolioForm.deleteProperty'))) return;
        setLoading(true);
        try {
            await deletePropertyInvestment(property.id);
            window.dispatchEvent(new Event('portfolio-updated'));
            closeInspector();
        } catch (err) {
            console.error('Error deleting property:', err);
            addToast(t('portfolioForm.failedToDelete'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const countries = basePrices ? Object.keys(basePrices) : [];
    const cities = basePrices?.[formData.country]?.cities
        ? Object.keys(basePrices[formData.country].cities)
        : [];

    const hasValuation = computedValue != null;

    return (
        <div className="portfolio-form">
            <h3>{isEdit ? t('portfolioForm.editProperty') : t('portfolioForm.addProperty')}</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>{t('portfolioForm.propertyName')}</label>
                    <input type="text" placeholder="e.g. Prague Flat" value={formData.name}
                        onChange={e => update('name', e.target.value)} required />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.type')}</label>
                        <select value={formData.property_type} onChange={e => update('property_type', e.target.value)}>
                            {PROPERTY_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('portfolioForm.rooms')}</label>
                        <input type="number" min="1" placeholder="3" value={formData.rooms}
                            onChange={e => update('rooms', e.target.value)} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.country')}</label>
                        <select value={formData.country} onChange={e => handleCountryChange(e.target.value)}>
                            <option value="">{t('portfolioForm.selectCountry')}</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('portfolioForm.city')}</label>
                        <input
                            type="text"
                            list="city-list"
                            placeholder="Type or select..."
                            value={formData.city}
                            onChange={e => handleCityChange(e.target.value)}
                        />
                        <datalist id="city-list">
                            {cities.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.addressOptional')}</label>
                    <input type="text" placeholder="Street and number" value={formData.address}
                        onChange={e => update('address', e.target.value)} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.squareMeters')}</label>
                        <input type="number" step="0.01" placeholder="75" value={formData.square_meters}
                            onChange={e => update('square_meters', e.target.value)} required />
                    </div>
                    <div className="form-group form-group-small">
                        <label>{t('portfolioForm.currency')}</label>
                        <select value={formData.currency} onChange={e => update('currency', e.target.value)}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>{t('portfolioForm.features')}</label>
                    <div className="checkbox-row">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={formData.has_balcony}
                                onChange={e => update('has_balcony', e.target.checked)} />
                            {t('portfolioForm.balcony')}
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={formData.has_garden}
                                onChange={e => update('has_garden', e.target.checked)} />
                            {t('portfolioForm.garden')}
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={formData.has_parking}
                                onChange={e => update('has_parking', e.target.checked)} />
                            {t('portfolioForm.parking')}
                        </label>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('portfolioForm.renovationState')}</label>
                        <select value={formData.renovation_state} onChange={e => update('renovation_state', e.target.value)}>
                            {RENOVATION_STATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                    {formData.property_type === 'flat' && (
                        <div className="form-group">
                            <label>{t('portfolioForm.floor')}</label>
                            <select value={formData.floor} onChange={e => update('floor', e.target.value)}>
                                <option value="">{t('portfolioForm.notSpecified')}</option>
                                {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label>{t('portfolioForm.purchasePriceTotal')}</label>
                    <input type="number" step="0.01" placeholder="5000000" value={formData.purchase_price}
                        onChange={e => update('purchase_price', e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.purchaseDate')}</label>
                    <input type="date" value={formData.purchase_date}
                        onChange={e => update('purchase_date', e.target.value)} />
                </div>
                {/* Valuation -- fully automatic */}
                <div className="computed-metrics">
                    {priceSource && ppsqm > 0 && (
                        <div className="metric-row">
                            <span>{t('portfolioForm.pricePerSqm', { source: priceSource })}</span>
                            <span>{formatMoney(ppsqm)} {formData.currency}/m\u00B2</span>
                        </div>
                    )}
                    {purchasePrice > 0 && (
                        <div className="metric-row">
                            <span>{t('portfolioForm.youPaid')}</span>
                            <span>{formatMoney(purchasePrice)} {formData.currency}</span>
                        </div>
                    )}
                    {hasValuation ? (
                        <>
                            <div className="metric-row highlight">
                                <span>{t('portfolioForm.estimatedValueToday')}</span>
                                <span>{formatMoney(computedValue)} {formData.currency}</span>
                            </div>
                            {purchasePrice > 0 && gainLoss != null && (
                                <div className={`metric-row ${gainLoss >= 0 ? 'positive' : 'negative'}`}>
                                    <span>{gainLoss >= 0 ? t('portfolioForm.profitVsPurchase') : t('portfolioForm.lossVsPurchase')}</span>
                                    <span>
                                        {gainLoss >= 0 ? '+' : ''}{formatMoney(gainLoss)} ({gainPct?.toFixed(1)}%)
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        sqm > 0 && !priceSource && (
                            <div className="metric-row neutral-hint">
                                <span>{t('portfolioForm.selectCountryHint')}</span>
                            </div>
                        )
                    )}
                </div>

                {isEdit && (
                    <PropertyValueChart
                        propertyId={property.id}
                        purchasePrice={purchasePrice}
                        currency={formData.currency}
                    />
                )}

                <div className="form-group">
                    <label>{t('portfolioForm.manualValueOverride')}</label>
                    <input type="number" step="0.01" placeholder="Leave empty for automatic valuation"
                        value={formData.estimated_value}
                        onChange={e => update('estimated_value', e.target.value)} />
                </div>

                <div className="form-group">
                    <label>{t('portfolioForm.notes')}</label>
                    <textarea placeholder="Optional notes..." value={formData.notes}
                        onChange={e => update('notes', e.target.value)} rows={2} />
                </div>
                <div className="form-group">
                    <label>{t('portfolioForm.color')}</label>
                    <div className="color-picker">
                        {PRESET_COLORS.map(c => (
                            <div key={c} className={`color-swatch ${formData.color === c ? 'selected' : ''}`}
                                style={{ background: c }} onClick={() => update('color', c)} />
                        ))}
                    </div>
                </div>
                <div className="form-actions">
                    {isEdit && (
                        <button type="button" className="delete-btn" onClick={handleDelete} disabled={loading}>
                            <Trash2 size={18} />
                            <span>{t('portfolioForm.delete')}</span>
                        </button>
                    )}
                    <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                        <span>{isEdit ? t('portfolioForm.update') : t('portfolioForm.save')}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
