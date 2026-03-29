import React, { useState, useEffect } from 'react';
import { Pencil, Plus, Trash2, X, AlertCircle, ChevronDown, ChevronRight, Check, Save, GripVertical } from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    getCategories, createCategory, updateCategory, deleteCategory,
    getCategoryMappings, addCategoryMapping, deleteCategoryMapping,
    reorderCategories,
} from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n';
import './CategoryEditor.css';

// Suggested categories users can quickly add
const SUGGESTED_CATEGORIES = {
    general: [
        { name: 'Groceries', color: '#10b981' },
        { name: 'Eating out', color: '#f59e0b' },
        { name: 'Transport', color: '#3b82f6' },
        { name: 'Shopping', color: '#ec4899' },
        { name: 'Entertainment', color: '#8b5cf6' },
        { name: 'Health & Medical', color: '#ef4444' },
        { name: 'Education', color: '#06b6d4' },
        { name: 'Gifts', color: '#f43f5e' },
        { name: 'Salary', color: '#22c55e' },
        { name: 'Freelance', color: '#3b82f6' },
        { name: 'Investments', color: '#8b5cf6' },
        { name: 'Other Income', color: '#6366f1' },
    ],
    fixed: [
        { name: 'Electricity', color: '#f59e0b' },
        { name: 'Mortgage', color: '#14b8a6' },
        { name: 'Internet', color: '#6366f1' },
        { name: 'Phone', color: '#3b82f6' },
        { name: 'Water', color: '#06b6d4' },
        { name: 'Gas', color: '#f97316' },
        { name: 'Insurance', color: '#ef4444' },
        { name: 'Subscriptions', color: '#a855f7' },
        { name: 'Rent', color: '#14b8a6' },
    ],
    in_and_out: [
        { name: 'Internal Transfer', color: '#94a3b8' },
        { name: 'Revolut Top-up', color: '#64748b' },
        { name: 'Between Accounts', color: '#78716c' },
        { name: 'Saving account', color: '#84cc16' },
    ],
};

export function CategoryEditor({ onSuccess }) {
    const [categories, setCategories] = useState([]);
    const [expandedCategoryId, setExpandedCategoryId] = useState(null);
    const [mappings, setMappings] = useState({});
    const [newMapping, setNewMapping] = useState({ keyword: '', match_type: 'substring' });
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [editingColorId, setEditingColorId] = useState(null);
    const [editingColor, setEditingColor] = useState('');
    const [newCategory, setNewCategory] = useState({ name: '', section: 'general', color: '#6366f1' });
    const [showNewForm, setShowNewForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const data = await getCategories();
            setCategories(data);
        } catch (err) {
            addToast(t('categories.failedToLoad'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadMappings = async (categoryId) => {
        try {
            const data = await getCategoryMappings(categoryId);
            setMappings(prev => ({ ...prev, [categoryId]: data }));
        } catch (err) {
            addToast(t('categories.failedToLoadKeywords'), 'error');
        }
    };

    const handleToggleExpand = async (categoryId) => {
        if (expandedCategoryId === categoryId) {
            setExpandedCategoryId(null);
        } else {
            setExpandedCategoryId(categoryId);
            setNewMapping({ keyword: '', match_type: 'substring' });
            if (!mappings[categoryId]) {
                await loadMappings(categoryId);
            }
        }
    };

    const handleChangeSection = async (categoryId, newSection) => {
        try {
            await updateCategory(categoryId, { section: newSection });
            await loadCategories();
            addToast(t('categories.categoryMoved'), 'success');
            if (onSuccess) onSuccess();
        } catch (err) {
            addToast(t('categories.failedToMove'), 'error');
        }
    };

    const handleStartEdit = (category, e) => {
        e.stopPropagation();
        setEditingCategoryId(category.id);
        setEditingName(category.name);
    };

    const handleCancelEdit = () => {
        setEditingCategoryId(null);
        setEditingName('');
    };

    const handleSaveEdit = async (categoryId) => {
        if (!editingName.trim()) {
            addToast(t('categories.nameEmpty'), 'error');
            return;
        }

        try {
            await updateCategory(categoryId, { name: editingName.trim() });
            await loadCategories();
            setEditingCategoryId(null);
            setEditingName('');
            addToast(t('categories.categoryRenamed'), 'success');
            if (onSuccess) onSuccess();
        } catch (err) {
            addToast(t('categories.failedToRename'), 'error');
        }
    };

    const handleStartColorEdit = (category, e) => {
        e.stopPropagation();
        setEditingColorId(category.id);
        setEditingColor(category.color || '#6366f1');
    };

    const handleSaveColor = async (categoryId) => {
        try {
            await updateCategory(categoryId, { color: editingColor });
            await loadCategories();
            setEditingColorId(null);
            setEditingColor('');
            addToast(t('categories.colorUpdated'), 'success');
            if (onSuccess) onSuccess();
        } catch (err) {
            addToast(t('categories.failedToUpdateColor'), 'error');
        }
    };

    const handleCancelColorEdit = () => {
        setEditingColorId(null);
        setEditingColor('');
    };

    const handleSelectSuggestion = (suggestion) => {
        setNewCategory({
            name: suggestion.name,
            section: newCategory.section,
            color: suggestion.color,
        });
    };

    const handleCreateCategory = async () => {
        if (!newCategory.name.trim()) {
            addToast(t('categories.nameEmpty'), 'error');
            return;
        }

        try {
            await createCategory({
                name: newCategory.name.trim(),
                section: newCategory.section,
                color: newCategory.color,
            });
            await loadCategories();
            setNewCategory({ name: '', section: 'general', color: '#6366f1' });
            setShowNewForm(false);
            addToast(t('categories.categoryCreated'), 'success');
            if (onSuccess) onSuccess();
        } catch (err) {
            addToast(t('categories.failedToCreate'), 'error');
        }
    };

    const handleDeleteCategory = async (categoryId, categoryName) => {
        if (!window.confirm(t('categories.deleteConfirm', { name: categoryName }))) return;

        try {
            await deleteCategory(categoryId);
            await loadCategories();
            setExpandedCategoryId(null);
            addToast(t('categories.categoryDeleted'), 'success');
            if (onSuccess) onSuccess();
        } catch (err) {
            addToast(t('categories.failedToDelete'), 'error');
        }
    };

    const handleAddMapping = async (categoryId) => {
        if (!newMapping.keyword.trim()) {
            addToast(t('categories.keywordEmpty'), 'error');
            return;
        }

        try {
            await addCategoryMapping({
                category_id: categoryId,
                keyword: newMapping.keyword.trim(),
                match_type: newMapping.match_type,
            });
            await loadMappings(categoryId);
            setNewMapping({ keyword: '', match_type: 'substring' });
            addToast(t('categories.keywordAdded'), 'success');
        } catch (err) {
            addToast(t('categories.failedToAddKeyword'), 'error');
        }
    };

    const handleDeleteMapping = async (mappingId, categoryId) => {
        try {
            await deleteCategoryMapping(mappingId);
            await loadMappings(categoryId);
            addToast(t('categories.keywordDeleted'), 'success');
        } catch (err) {
            addToast(t('categories.failedToDeleteKeyword'), 'error');
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = async (event, group) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const sectionCats = categories.filter(c => c.section === group);
        const oldIndex = sectionCats.findIndex(c => c.id === active.id);
        const newIndex = sectionCats.findIndex(c => c.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sectionCats, oldIndex, newIndex);

        // Optimistic update
        const otherCats = categories.filter(c => c.section !== group);
        setCategories([...otherCats, ...reordered]);

        try {
            await reorderCategories(reordered.map(c => c.id));
        } catch (err) {
            addToast(t('categories.failedToSaveOrder'), 'error');
            await loadCategories();
        }
    };

    if (loading) return <div className="loading">{t('categories.loadingCategories')}</div>;

    // Group categories by section
    const generalCategories = categories.filter(c => c.section === 'general');
    const fixedCategories = categories.filter(c => c.section === 'fixed');
    const inAndOutCategories = categories.filter(c => c.section === 'in_and_out');

    return (
        <div className="category-editor">
            <div className="info-box">
                <AlertCircle size={16} />
                <p>{t('categories.infoText')}</p>
            </div>

            {/* Create New Category Button */}
            {!showNewForm && (
                <button className="create-category-btn" onClick={() => setShowNewForm(true)}>
                    <Plus size={16} />
                    {t('categories.createNewCategory')}
                </button>
            )}

            {/* New Category Form */}
            {showNewForm && (
                <div className="new-category-form">
                    <h4>{t('categories.createNewCategory')}</h4>

                    {/* Quick suggestions */}
                    <div className="category-suggestions">
                        <p className="suggestions-label">{t('categories.quickSuggestions')}</p>
                        <div className="suggestions-grid">
                            {(SUGGESTED_CATEGORIES[newCategory.section] || []).map((suggestion, idx) => (
                                <button
                                    key={idx}
                                    className="suggestion-chip"
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    style={{ borderColor: suggestion.color }}
                                >
                                    <span className="chip-dot" style={{ background: suggestion.color }} />
                                    {suggestion.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-row">
                        <input
                            type="text"
                            placeholder={t('categories.categoryNamePlaceholder')}
                            value={newCategory.name}
                            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') handleCreateCategory();
                            }}
                        />
                        <select
                            value={newCategory.section}
                            onChange={(e) => setNewCategory({ ...newCategory, section: e.target.value })}
                        >
                            <option value="general">{t('categories.general')}</option>
                            <option value="fixed">{t('categories.fixedBills')}</option>
                            <option value="in_and_out">{t('categories.inAndOut')}</option>
                        </select>
                        <input
                            type="color"
                            value={newCategory.color}
                            onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                            title={t('categories.categoryColor')}
                        />
                    </div>
                    <div className="form-actions">
                        <button className="save-btn" onClick={handleCreateCategory}>
                            <Save size={14} />
                            {t('categories.create')}
                        </button>
                        <button className="cancel-btn" onClick={() => setShowNewForm(false)}>
                            <X size={14} />
                            {t('categories.cancel')}
                        </button>
                    </div>
                </div>
            )}

            <div className="category-section">
                <h3>{t('categories.categoriesCount', { count: generalCategories.length })}</h3>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'general')}>
                    <SortableContext items={generalCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        <div className="category-list">
                            {generalCategories.map(cat => (
                                <SortableCategoryItem
                                    key={cat.id}
                                    category={cat}
                                    isExpanded={expandedCategoryId === cat.id}
                                    isEditing={editingCategoryId === cat.id}
                                    editingName={editingName}
                                    isEditingColor={editingColorId === cat.id}
                                    editingColor={editingColor}
                                    mappings={mappings[cat.id] || []}
                                    newMapping={newMapping}
                                    onToggleExpand={() => handleToggleExpand(cat.id)}
                                    onStartEdit={(e) => handleStartEdit(cat, e)}
                                    onSaveEdit={() => handleSaveEdit(cat.id)}
                                    onCancelEdit={handleCancelEdit}
                                    onEditingNameChange={setEditingName}
                                    onStartColorEdit={(e) => handleStartColorEdit(cat, e)}
                                    onSaveColor={() => handleSaveColor(cat.id)}
                                    onCancelColorEdit={handleCancelColorEdit}
                                    onEditingColorChange={setEditingColor}
                                    onDelete={() => handleDeleteCategory(cat.id, cat.name)}
                                    onAddMapping={() => handleAddMapping(cat.id)}
                                    onDeleteMapping={(mappingId) => handleDeleteMapping(mappingId, cat.id)}
                                    onNewMappingChange={setNewMapping}
                                    onChangeSection={(s) => handleChangeSection(cat.id, s)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <div className="category-section">
                <h3>{t('categories.fixedBillsCount', { count: fixedCategories.length })}</h3>
                <p className="section-hint">{t('categories.fixedBillsHint')}</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'fixed')}>
                    <SortableContext items={fixedCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        <div className="category-list">
                            {fixedCategories.map(cat => (
                                <SortableCategoryItem
                                    key={cat.id}
                                    category={cat}
                                    isExpanded={expandedCategoryId === cat.id}
                                    isEditing={editingCategoryId === cat.id}
                                    editingName={editingName}
                                    isEditingColor={editingColorId === cat.id}
                                    editingColor={editingColor}
                                    mappings={mappings[cat.id] || []}
                                    newMapping={newMapping}
                                    onToggleExpand={() => handleToggleExpand(cat.id)}
                                    onStartEdit={(e) => handleStartEdit(cat, e)}
                                    onSaveEdit={() => handleSaveEdit(cat.id)}
                                    onCancelEdit={handleCancelEdit}
                                    onEditingNameChange={setEditingName}
                                    onStartColorEdit={(e) => handleStartColorEdit(cat, e)}
                                    onSaveColor={() => handleSaveColor(cat.id)}
                                    onCancelColorEdit={handleCancelColorEdit}
                                    onEditingColorChange={setEditingColor}
                                    onDelete={() => handleDeleteCategory(cat.id, cat.name)}
                                    onAddMapping={() => handleAddMapping(cat.id)}
                                    onDeleteMapping={(mappingId) => handleDeleteMapping(mappingId, cat.id)}
                                    onNewMappingChange={setNewMapping}
                                    onChangeSection={(s) => handleChangeSection(cat.id, s)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <div className="category-section">
                <h3>{t('categories.inAndOutCount', { count: inAndOutCategories.length })}</h3>
                <p className="section-hint">{t('categories.inAndOutHint')}</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'in_and_out')}>
                    <SortableContext items={inAndOutCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        <div className="category-list">
                            {inAndOutCategories.map(cat => (
                                <SortableCategoryItem
                                    key={cat.id}
                                    category={cat}
                                    isExpanded={expandedCategoryId === cat.id}
                                    isEditing={editingCategoryId === cat.id}
                                    editingName={editingName}
                                    isEditingColor={editingColorId === cat.id}
                                    editingColor={editingColor}
                                    mappings={mappings[cat.id] || []}
                                    newMapping={newMapping}
                                    onToggleExpand={() => handleToggleExpand(cat.id)}
                                    onStartEdit={(e) => handleStartEdit(cat, e)}
                                    onSaveEdit={() => handleSaveEdit(cat.id)}
                                    onCancelEdit={handleCancelEdit}
                                    onEditingNameChange={setEditingName}
                                    onStartColorEdit={(e) => handleStartColorEdit(cat, e)}
                                    onSaveColor={() => handleSaveColor(cat.id)}
                                    onCancelColorEdit={handleCancelColorEdit}
                                    onEditingColorChange={setEditingColor}
                                    onDelete={() => handleDeleteCategory(cat.id, cat.name)}
                                    onAddMapping={() => handleAddMapping(cat.id)}
                                    onDeleteMapping={(mappingId) => handleDeleteMapping(mappingId, cat.id)}
                                    onNewMappingChange={setNewMapping}
                                    onChangeSection={(s) => handleChangeSection(cat.id, s)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}

function SortableCategoryItem(props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: props.category.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <CategoryItem {...props} dragListeners={listeners} />
        </div>
    );
}

function CategoryItem({
    category,
    isExpanded,
    isEditing,
    editingName,
    isEditingColor,
    editingColor,
    mappings,
    newMapping,
    onToggleExpand,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditingNameChange,
    onStartColorEdit,
    onSaveColor,
    onCancelColorEdit,
    onEditingColorChange,
    onDelete,
    onAddMapping,
    onDeleteMapping,
    onNewMappingChange,
    onChangeSection,
    dragListeners,
}) {
    const { t } = useTranslation();
    return (
        <div className="category-item">
            <div className="category-header" onClick={!isEditing ? onToggleExpand : undefined}>
                <div className="drag-handle" {...dragListeners} onClick={(e) => e.stopPropagation()} title={t('categories.dragToReorder')}>
                    <GripVertical size={14} />
                </div>
                <div className="category-info">
                    {!isEditing && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                    {!isEditingColor && category.color && (
                        <div
                            className="category-dot"
                            style={{ background: category.color, cursor: 'pointer' }}
                            onClick={onStartColorEdit}
                            title={t('categories.clickToChangeColor')}
                        />
                    )}
                    {isEditingColor && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input
                                type="color"
                                value={editingColor}
                                onChange={(e) => onEditingColorChange(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    background: 'transparent'
                                }}
                            />
                            <button
                                className="save-edit-btn"
                                onClick={(e) => { e.stopPropagation(); onSaveColor(); }}
                                title={t('categories.saveColor')}
                            >
                                <Check size={12} />
                            </button>
                            <button
                                className="cancel-edit-btn"
                                onClick={(e) => { e.stopPropagation(); onCancelColorEdit(); }}
                                title={t('categories.cancel')}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {isEditing ? (
                        <input
                            type="text"
                            className="edit-name-input"
                            value={editingName}
                            onChange={(e) => onEditingNameChange(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') onSaveEdit();
                                if (e.key === 'Escape') onCancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    ) : (
                        <>
                            <span className="category-name">{category.name}</span>
                            <span className="mapping-count">{t('categories.keywords', { count: category.mapping_count ?? mappings.length })}</span>
                        </>
                    )}
                </div>
                <div className="category-actions">
                    {isEditing ? (
                        <>
                            <button
                                className="save-edit-btn"
                                onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}
                                title={t('categories.save')}
                            >
                                <Check size={14} />
                            </button>
                            <button
                                className="cancel-edit-btn"
                                onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                                title={t('categories.cancel')}
                            >
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="edit-btn"
                                onClick={onStartEdit}
                                title={t('categories.renameCategory')}
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                className="delete-btn"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                title={t('categories.deleteCategory')}
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isExpanded && !isEditing && (
                <div className="mappings-section">
                    <div className="section-selector">
                        <label>{t('categories.sectionLabel')}</label>
                        <select
                            value={category.section}
                            onChange={(e) => onChangeSection(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <option value="general">{t('categories.general')}</option>
                            <option value="fixed">{t('categories.fixedBills')}</option>
                            <option value="in_and_out">{t('categories.inAndOut')}</option>
                        </select>
                    </div>
                    <h4>{t('categories.autoMatchKeywords')}</h4>
                    {mappings.length === 0 ? (
                        <p className="no-mappings">{t('categories.noKeywords')}</p>
                    ) : (
                        <div className="mappings-list">
                            {mappings.map(mapping => (
                                <div key={mapping.id} className="mapping-item">
                                    <span className="mapping-keyword">{mapping.keyword}</span>
                                    <span className={`mapping-type ${mapping.match_type}`}>
                                        {mapping.match_type}
                                    </span>
                                    <button
                                        onClick={() => onDeleteMapping(mapping.id)}
                                        title={t('categories.deleteKeyword')}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="add-mapping">
                        <input
                            type="text"
                            placeholder={t('categories.addKeywordPlaceholder')}
                            value={newMapping.keyword}
                            onChange={(e) => onNewMappingChange({ ...newMapping, keyword: e.target.value })}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') onAddMapping();
                            }}
                        />
                        <select
                            value={newMapping.match_type}
                            onChange={(e) => onNewMappingChange({ ...newMapping, match_type: e.target.value })}
                            title={t('categories.matchType')}
                        >
                            <option value="substring">{t('categories.substring')}</option>
                            <option value="exact">{t('categories.exact')}</option>
                            <option value="regex">{t('categories.regex')}</option>
                        </select>
                        <button onClick={onAddMapping} title={t('categories.addKeyword')}>
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
