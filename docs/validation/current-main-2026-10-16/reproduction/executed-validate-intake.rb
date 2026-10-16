require 'yaml'
require 'json'
require 'date'

path = '/workspace/klisteniapp/docs/integration/qa-20261016/intake.md'
schema = YAML.safe_load(File.read('/workspace/sysadmin-workspace/atlas/catalog/intake.yaml'), aliases: false)
frontmatter = /\A---\n(.*?)\n---\n/m.match(File.read(path)) or raise 'Missing frontmatter'
data = YAML.safe_load(frontmatter[1], aliases: false)
missing = schema.fetch('entry_required_frontmatter') - data.keys
raise "Missing fields: #{missing}" unless missing.empty?
schema.fetch('entry_required_frontmatter').each { |key| raise "Invalid #{key}" unless data[key].is_a?(String) && !data[key].empty? }
{'domain' => 'domains', 'source_type' => 'source_types'}.each { |field, key| raise "Invalid #{field}" unless schema.fetch(key).include?(data[field]) }
{'sensitivity' => 'sensitivities', 'status' => 'statuses'}.each { |field, key| raise "Invalid #{field}" unless schema.fetch(key).key?(data[field]) }
raise 'Wrong owner or lifecycle' unless data['entity'] == 'orchid-labs' && data['status'] == 'draft' && data['sensitivity'] == 'normal'
Date.iso8601(data.fetch('created'))
source = File.expand_path(data.fetch('source'), File.dirname(path))
raise 'Missing owner evidence source' unless File.file?(source)
puts JSON.pretty_generate({status: 'pass', requiredFields: schema.fetch('entry_required_frontmatter').length, schemaRevision: 'd20e288168ee04177e8864a43c13bd05a864238a', entry: data['id'], sensitivity: data['sensitivity'], lifecycle: data['status']})
