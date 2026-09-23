import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.recommended,
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
);
