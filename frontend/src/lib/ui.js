function pushClassValue(value, target) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((item) => pushClassValue(item, target));
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, enabled]) => {
      if (enabled) target.push(key);
    });
    return;
  }

  target.push(String(value));
}

export function cn(...values) {
  const classes = [];
  values.forEach((value) => pushClassValue(value, classes));
  return classes.join(' ');
}
