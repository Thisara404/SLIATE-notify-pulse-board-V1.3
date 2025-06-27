import { Button } from '@/components/ui/button';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dialog } from '@/components/ui/dialog';
import { useState } from 'react';
import { 
  FileText, 
  CalendarDays, 
  GraduationCap,
  LayoutTemplate // Using LayoutTemplate instead of Templates
} from 'lucide-react';

interface NoticeTemplatesProps {
  onSelectTemplate: (template: string) => void;
}

const NoticeTemplates = ({ onSelectTemplate }: NoticeTemplatesProps) => {
  const [open, setOpen] = useState(false);

  const templates = [
    {
      id: 'general',
      title: 'General Announcement',
      icon: <FileText className="h-5 w-5 text-blue-500" />,
      template: `## General Announcement

Dear Students and Staff,

We would like to inform you about the following:

- Important point 1
- Important point 2
- Important point 3

For more details, please contact us at [contact information].

Thank you for your attention.`,
    },
    {
      id: 'event',
      title: 'Event Announcement',
      icon: <CalendarDays className="h-5 w-5 text-green-500" />,
      template: `## Upcoming Event

**Event:** [Event Name]
**Date:** [Date]
**Time:** [Time]
**Location:** [Location]

**Description:**
[Event description goes here]

Please register by [deadline] by [registration method].

We look forward to your participation!`,
    },
    {
      id: 'academic',
      title: 'Academic Notice',
      icon: <GraduationCap className="h-5 w-5 text-amber-500" />,
      template: `## Academic Notice

**Subject:** [Subject]
**Department:** [Department]
**Applicable to:** [Target audience]

Dear Students,

[Academic announcement details]

Important deadlines:
- [Deadline 1]
- [Deadline 2]

For any clarifications, please contact your academic advisor.`,
    },
  ];

  const handleSelectTemplate = (template: string) => {
    onSelectTemplate(template);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <LayoutTemplate className="h-4 w-4" />
        <span>Use Template</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a Template</DialogTitle>
            <DialogDescription>
              Select a pre-designed template for your notice
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {templates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="flex items-center justify-start gap-3 h-auto p-4"
                onClick={() => handleSelectTemplate(template.template)}
              >
                {template.icon}
                <div className="text-left">
                  <div className="font-medium">{template.title}</div>
                  <div className="text-sm text-gray-500">
                    Use this template for {template.id} notices
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NoticeTemplates;