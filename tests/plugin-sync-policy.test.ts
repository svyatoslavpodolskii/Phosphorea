import {it,expect} from 'vitest';
import {acceptsPluginSetting,pluginSyncMode} from '../src/sync/profile';
it('defaults to the full functional profile and keeps visual sync independent',()=>{
 const installed=new Set(['my.notes']);expect(pluginSyncMode(undefined)).toBe('all');
 for(const key of ['disabled-builtins','community-plugins','preferences','plugin:other.notes:config'])expect(acceptsPluginSetting(key,'all',installed)).toBe(true);
 expect(acceptsPluginSetting('appearance-profile','local',installed)).toBe(true);
 expect(acceptsPluginSetting('plugin:builtin.zoom:style','local',installed)).toBe(true);
});
it('settings-only never installs, removes or toggles plugins, and accepts only existing plugin settings',()=>{
 const installed=new Set(['my.notes']);
 for(const key of ['disabled-builtins','community-plugins','plugin:other.notes:config'])expect(acceptsPluginSetting(key,'settings',installed)).toBe(false);
 for(const key of ['preferences','plugin:my.notes:config','plugin:builtin.templates:catalog'])expect(acceptsPluginSetting(key,'settings',installed)).toBe(true);
 for(const key of ['disabled-builtins','community-plugins','preferences','plugin:my.notes:config'])expect(acceptsPluginSetting(key,'local',installed)).toBe(false);
});
