import React, { useState } from 'react';
import axios from 'axios';
import { useInspector } from '../context/InspectorContext';
import { Save, Loader2 } from 'lucide-react';
import './GoalEditor.css';

const API_BASE = 'http://localhost:8000';
const PRESET_COLORS = ['#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#fbbf24', '#f97316'];

export function GoalEditor({ onSuccess }) {
    const { closeInspector } = useInspector();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        target_amount: '',
        current_amount: '0',
        color: PRESET_COLORS[0]
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/goals`, {
                ...formData,
                target_amount: Number(formData.target_amount),
                current_amount: Number(formData.current_amount)
            });
            if (onSuccess) onSuccess(); // Trigger refresh in parent
            closeInspector();
        } catch (error) {
            console.error("Error saving goal:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="goal-editor">
            <h3>Create New Goal</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Goal Name</label>
                    <input
                        type="text"
                        placeholder="e.g. New Car, Vacation"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Target Amount (Kč)</label>
                    <input
                        type="number"
                        placeholder="50000"
                        value={formData.target_amount}
                        onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Current Savings (Kč)</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={formData.current_amount}
                        onChange={e => setFormData({ ...formData, current_amount: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>Color Tag</label>
                    <div className="color-picker">
                        {PRESET_COLORS.map(c => (
                            <div
                                key={c}
                                className={`color-swatch ${formData.color === c ? 'selected' : ''}`}
                                style={{ background: c }}
                                onClick={() => setFormData({ ...formData, color: c })}
                            />
                        ))}
                    </div>
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                    {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    <span>Save Goal</span>
                </button>
            </form>
        </div>
    );
}
