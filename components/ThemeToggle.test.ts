// @vitest-environment nuxt
// ThemeToggle.vue のテスト。
// useColorMode は Nuxt auto-import なので mockNuxtImport で差し替える。
// nuxt environment が必要 (Nuxt instance を立ち上げて useState/useNuxtApp が動く状態にする)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import ThemeToggle from './ThemeToggle.vue';

const colorModeStub = reactive<{ preference: 'light' | 'system' | 'dark'; value: string }>({
  preference: 'system',
  value: 'light',
});

mockNuxtImport('useColorMode', () => () => colorModeStub);

describe('ThemeToggle', () => {
  beforeEach(() => {
    colorModeStub.preference = 'system';
    colorModeStub.value = 'light';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('3 つのトグルボタン (ライト / 自動 / ダーク) を描画する', async () => {
    const wrapper = await mountSuspended(ThemeToggle);

    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.text()).toContain('ライト');
    expect(buttons[1]?.text()).toContain('自動');
    expect(buttons[2]?.text()).toContain('ダーク');
  });

  it('preference=system でマウント後「自動」ボタンに aria-pressed=true', async () => {
    colorModeStub.preference = 'system';
    const wrapper = await mountSuspended(ThemeToggle);

    const buttons = wrapper.findAll('button');
    expect(buttons[0]?.attributes('aria-pressed')).toBe('false');
    expect(buttons[1]?.attributes('aria-pressed')).toBe('true');
    expect(buttons[2]?.attributes('aria-pressed')).toBe('false');
  });

  it('preference=dark でマウント後「ダーク」ボタンに aria-pressed=true', async () => {
    colorModeStub.preference = 'dark';
    const wrapper = await mountSuspended(ThemeToggle);

    const buttons = wrapper.findAll('button');
    expect(buttons[2]?.attributes('aria-pressed')).toBe('true');
    expect(buttons[0]?.attributes('aria-pressed')).toBe('false');
    expect(buttons[1]?.attributes('aria-pressed')).toBe('false');
  });

  it('ダークボタン click で colorMode.preference が dark になる', async () => {
    colorModeStub.preference = 'system';
    const wrapper = await mountSuspended(ThemeToggle);

    const darkBtn = wrapper.findAll('button')[2];
    expect(darkBtn).toBeDefined();
    await darkBtn?.trigger('click');
    expect(colorModeStub.preference).toBe('dark');
  });

  it('ライトボタン click で colorMode.preference が light になる', async () => {
    colorModeStub.preference = 'dark';
    const wrapper = await mountSuspended(ThemeToggle);

    const lightBtn = wrapper.findAll('button')[0];
    expect(lightBtn).toBeDefined();
    await lightBtn?.trigger('click');
    expect(colorModeStub.preference).toBe('light');
  });

  it('role=group / aria-label="テーマ切替" がついている (a11y)', async () => {
    const wrapper = await mountSuspended(ThemeToggle);

    const group = wrapper.find('[role="group"]');
    expect(group.exists()).toBe(true);
    expect(group.attributes('aria-label')).toBe('テーマ切替');
  });
});
