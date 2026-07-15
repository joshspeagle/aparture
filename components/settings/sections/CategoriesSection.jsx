import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ARXIV_CATEGORIES, getCategoryDisplayName } from '../../../utils/arxivCategories.js';
import Button from '../../ui/Button.jsx';

export default function CategoriesSection({ config, setConfig, processing }) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showCategoryDropdown) return undefined;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
        setExpandedCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown]);

  const addCategory = (categoryCode) => {
    setConfig((prev) => ({
      ...prev,
      selectedCategories: [...new Set([...prev.selectedCategories, categoryCode])],
    }));
  };

  const removeCategory = (categoryCode) => {
    setConfig((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.filter((cat) => cat !== categoryCode),
    }));
  };

  const addMainCategory = (mainCategoryName) => {
    const categoryData = ARXIV_CATEGORIES[mainCategoryName];
    if (!categoryData) return;
    const newCategories = Object.values(categoryData.subcategories).map((subcat) => subcat.code);
    setConfig((prev) => ({
      ...prev,
      selectedCategories: [...new Set([...prev.selectedCategories, ...newCategories])],
    }));
  };

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          fontWeight: 500,
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        ArXiv Categories
      </label>

      <div
        style={{
          minHeight: '2.5rem',
          padding: 'var(--aparture-space-3)',
          background: 'var(--aparture-bg)',
          border: '1px solid var(--aparture-hairline)',
          borderRadius: '4px',
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        {config.selectedCategories.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--aparture-space-2)' }}>
            {config.selectedCategories.map((category) => (
              <span
                key={category}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  background: 'color-mix(in srgb, var(--aparture-accent) 15%, transparent)',
                  color: 'var(--aparture-accent)',
                  borderRadius: '4px',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  border: '1px solid color-mix(in srgb, var(--aparture-accent) 25%, transparent)',
                }}
              >
                {category}
                <button
                  onClick={() => removeCategory(category)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    lineHeight: 1,
                  }}
                  disabled={processing.isRunning}
                  title={getCategoryDisplayName(category)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
            }}
          >
            No categories selected
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <Button
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          disabled={processing.isRunning}
          style={{
            width: '100%',
            justifyContent: 'space-between',
            textAlign: 'left',
          }}
        >
          <span>Add Categories</span>
          <ChevronDown
            style={{
              width: '16px',
              height: '16px',
              transition: 'transform 150ms ease',
              transform: showCategoryDropdown ? 'rotate(180deg)' : 'none',
            }}
          />
        </Button>

        {showCategoryDropdown && (
          <div
            style={{
              position: 'absolute',
              zIndex: 50,
              width: '100%',
              marginTop: '4px',
              background: 'var(--aparture-surface)',
              border: '1px solid var(--aparture-hairline)',
              borderRadius: '4px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              maxHeight: '384px',
              overflowY: 'auto',
            }}
          >
            {Object.entries(ARXIV_CATEGORIES).map(([mainCategory, data]) => (
              <div
                key={mainCategory}
                style={{
                  borderBottom: '1px solid var(--aparture-hairline)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    onClick={() =>
                      setExpandedCategory(expandedCategory === mainCategory ? null : mainCategory)
                    }
                    style={{
                      flex: 1,
                      padding: 'var(--aparture-space-3) var(--aparture-space-4)',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--aparture-space-2)',
                      color: 'var(--aparture-ink)',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-sm)',
                    }}
                  >
                    {expandedCategory === mainCategory ? (
                      <ChevronDown style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <ChevronRight style={{ width: '16px', height: '16px' }} />
                    )}
                    <span style={{ fontWeight: 500, color: 'var(--aparture-ink)' }}>
                      {mainCategory}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                      }}
                    >
                      ({Object.keys(data.subcategories).length} categories)
                    </span>
                  </button>
                  <Button
                    onClick={() => addMainCategory(mainCategory)}
                    variant="ghost"
                    style={{
                      marginRight: 'var(--aparture-space-2)',
                      fontSize: 'var(--aparture-text-xs)',
                      padding: '4px 12px',
                      color: 'var(--aparture-accent)',
                    }}
                    title={`Add all ${mainCategory} categories`}
                  >
                    Add All
                  </Button>
                </div>

                {expandedCategory === mainCategory && (
                  <div style={{ background: 'var(--aparture-bg)' }}>
                    {Object.entries(data.subcategories).map(([_subKey, subData]) => (
                      <button
                        key={subData.code}
                        onClick={() => {
                          addCategory(subData.code);
                          setShowCategoryDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: 'var(--aparture-space-2) var(--aparture-space-8)',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'var(--aparture-font-sans)',
                          fontSize: 'var(--aparture-text-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: 'var(--aparture-ink)',
                          opacity: config.selectedCategories.includes(subData.code) ? 0.5 : 1,
                        }}
                        disabled={config.selectedCategories.includes(subData.code)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'var(--aparture-ink)' }}>{subData.code}</span>
                          <span
                            style={{
                              fontSize: 'var(--aparture-text-xs)',
                              color: 'var(--aparture-mute)',
                            }}
                          >
                            {subData.name}
                          </span>
                        </div>
                        {config.selectedCategories.includes(subData.code) && (
                          <span
                            style={{
                              fontSize: 'var(--aparture-text-xs)',
                              color: 'var(--aparture-accent)',
                            }}
                          >
                            ✓ Selected
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          color: 'var(--aparture-mute)',
          marginTop: '4px',
        }}
      >
        Click categories to select them. Use &quot;Add All&quot; to select entire sections.
      </p>
    </div>
  );
}
